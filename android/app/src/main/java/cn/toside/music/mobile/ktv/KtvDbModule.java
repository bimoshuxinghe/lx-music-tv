package cn.toside.music.mobile.ktv;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.tukaani.xz.XZInputStream;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * KTV 曲库数据库模块
 *
 * 负责把托管在服务器上的 ktv_song.db.xz（约 19MB，源库 112MB）下载并解压到
 * App 私有目录 filesDir/databases/ktv_song.db，然后提供本地 SQLite 查询接口
 * 给 JS 侧使用（搜索 / 歌手 / 分类 / 拼音 / 热度排行）。
 *
 * 数据表（来自点歌机曲库 song.db）：
 *   - song            歌曲主表（355,809 行）：name / singer_names / acronym(拼音) / number(点歌号)
 *                     / format / mtv_or_vcd(双音轨标记) / language_id / type_id / temperature
 *   - singer          歌手表（24,764 行）：name / acronym / form_id(男/女/组合) / region_id(大陆/港台/国外)
 *   - song_category   分类大类（主题/专题/综艺/戏曲/年代/推荐）
 *   - song_type       类型（45 个，挂在 category_id 下）
 *   - song_language   语种
 *   - singer_form / singer_region
 *   - song_module_item 推荐模块
 *
 * 播放地址不在库中，由 MusicAiIKtv spider 按 number 生成（见 KtvSpiderModule）。
 */
public class KtvDbModule extends ReactContextBaseJavaModule {
    private static final String TAG = "KtvDbModule";
    private static final String DB_FILE_NAME = "ktv_song.db";
    private static final int DOWNLOAD_BUFFER = 64 * 1024;
    private static final int PAGE_SIZE = 60;
    private static final int SEARCH_LIMIT = 200;

    private final ReactApplicationContext reactContext;
    private final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService queryExecutor = Executors.newFixedThreadPool(4);

    private volatile SQLiteDatabase db;
    private volatile boolean downloading = false;

    public KtvDbModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "KtvDb";
    }

    @Override
    public void invalidate() {
        super.invalidate();
        closeDb();
    }

    private void closeDb() {
        SQLiteDatabase d = db;
        db = null;
        if (d != null && d.isOpen()) d.close();
    }

    private File getDbFile() {
        return new File(reactContext.getFilesDir(), "databases/" + DB_FILE_NAME);
    }

    private File getTempXzFile() {
        return new File(reactContext.getCacheDir(), "ktv_song.db.xz");
    }

    private File getTempDbFile() {
        return new File(reactContext.getCacheDir(), "ktv_song.db");
    }

    private SQLiteDatabase getDb() throws Exception {
        SQLiteDatabase d = db;
        if (d != null && d.isOpen()) return d;
        File f = getDbFile();
        if (!f.exists() || f.length() == 0) {
            throw new IllegalStateException("曲库数据库不存在，请先调用 ensureDb");
        }
        SQLiteDatabase opened = SQLiteDatabase.openDatabase(f.getAbsolutePath(), null,
                SQLiteDatabase.OPEN_READONLY);
        db = opened;
        return opened;
    }

    private void sendProgress(double percent) {
        WritableMap m = Arguments.createMap();
        m.putDouble("progress", percent);
        m.putBoolean("downloading", true);
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("KtvDbDownloadProgress", m);
    }

    /** 下载并解压数据库。url 为 .xz 压缩包地址，force 为 true 时强制重新下载。 */
    @ReactMethod
    public void ensureDb(String url, boolean force, Promise promise) {
        downloadExecutor.execute(() -> {
            try {
                File target = getDbFile();
                if (!force && target.exists() && target.length() > 0) {
                    promise.resolve(statusMap());
                    return;
                }
                if (downloading) {
                    promise.resolve(statusMap());
                    return;
                }
                downloading = true;
                downloadAndExtract(url);
                promise.resolve(statusMap());
            } catch (Throwable e) {
                Log.e(TAG, "ensureDb failed", e);
                promise.reject("DB_DOWNLOAD_FAILED", e.getMessage(), e);
            } finally {
                downloading = false;
            }
        });
    }

    private void downloadAndExtract(String urlStr) throws Exception {
        File tmpXz = getTempXzFile();
        File tmpDb = getTempDbFile();
        if (tmpXz.exists()) tmpXz.delete();
        if (tmpDb.exists()) tmpDb.delete();

        sendProgress(0);
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setInstanceFollowRedirects(true);
        long total = conn.getContentLengthLong();
        long received = 0;
        try (InputStream in = new BufferedInputStream(conn.getInputStream(), DOWNLOAD_BUFFER);
             OutputStream out = new BufferedOutputStream(new FileOutputStream(tmpXz), DOWNLOAD_BUFFER)) {
            byte[] buf = new byte[DOWNLOAD_BUFFER];
            int len;
            while ((len = in.read(buf)) > 0) {
                out.write(buf, 0, len);
                received += len;
                if (total > 0) sendProgress(Math.min(100.0, received * 100.0 / total));
            }
            out.flush();
        } finally {
            conn.disconnect();
        }

        // 解压 xz -> 临时 db 文件
        sendProgress(100);
        try (XZInputStream xz = new XZInputStream(new BufferedInputStream(new FileInputStream(tmpXz), DOWNLOAD_BUFFER));
             OutputStream out = new BufferedOutputStream(new FileOutputStream(tmpDb), DOWNLOAD_BUFFER)) {
            byte[] buf = new byte[DOWNLOAD_BUFFER];
            int len;
            while ((len = xz.read(buf)) > 0) out.write(buf, 0, len);
            out.flush();
        }
        if (tmpXz.exists()) tmpXz.delete();

        // 校验是合法 SQLite 再落位
        SQLiteDatabase probe = SQLiteDatabase.openDatabase(tmpDb.getAbsolutePath(), null,
                SQLiteDatabase.OPEN_READONLY);
        try {
            probe.query("sqlite_master", new String[]{"name"}, null, null, null, null, null).close();
        } finally {
            probe.close();
        }

        File dbDir = getDbFile().getParentFile();
        if (dbDir != null && !dbDir.exists()) dbDir.mkdirs();
        closeDb();
        if (!tmpDb.renameTo(getDbFile())) {
            // renameTo 失败（跨目录/权限）时退化为 copy
            copyFile(tmpDb, getDbFile());
            tmpDb.delete();
        }
    }

    private void copyFile(File src, File dst) throws Exception {
        try (InputStream in = new BufferedInputStream(new FileInputStream(src));
             OutputStream out = new BufferedOutputStream(new FileOutputStream(dst))) {
            byte[] buf = new byte[DOWNLOAD_BUFFER];
            int len;
            while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
            out.flush();
        }
    }

    /** 返回数据库状态：是否存在、源库大小 */
    @ReactMethod
    public void getDbStatus(Promise promise) {
        try {
            promise.resolve(statusMap());
        } catch (Throwable e) {
            promise.reject("DB_STATUS_FAILED", e.getMessage(), e);
        }
    }

    private WritableMap statusMap() {
        File f = getDbFile();
        WritableMap m = Arguments.createMap();
        m.putBoolean("exists", f.exists() && f.length() > 0);
        m.putDouble("size", f.exists() ? f.length() : 0);
        m.putBoolean("downloading", downloading);
        return m;
    }

    /** 删除本地数据库（用于重新下载） */
    @ReactMethod
    public void clearDb(Promise promise) {
        queryExecutor.execute(() -> {
            try {
                closeDb();
                File f = getDbFile();
                if (f.exists()) f.delete();
                promise.resolve(statusMap());
            } catch (Throwable e) {
                promise.reject("DB_CLEAR_FAILED", e.getMessage(), e);
            }
        });
    }

    // ================= 查询接口 =================

    private static final String SONG_COLS =
            "id,name,singer_names,number,acronym,format,mtv_or_vcd,language_id,type_id,temperature,status";

    private WritableArray songsFromCursor(Cursor c) {
        WritableArray arr = Arguments.createArray();
        while (c.moveToNext()) {
            WritableMap m = Arguments.createMap();
            m.putInt("id", c.getInt(0));
            m.putString("name", c.getString(1));
            m.putString("singer", c.getString(2));
            m.putDouble("number", c.getLong(3));
            m.putString("acronym", c.getString(4));
            m.putString("format", c.getString(5));
            m.putString("mtvOrVcd", c.getString(6));
            m.putInt("languageId", c.getInt(7));
            m.putInt("typeId", c.getInt(8));
            m.putInt("temperature", c.getInt(9));
            arr.pushMap(m);
        }
        return arr;
    }

    private WritableArray querySongs(String where, String[] args, String orderBy, String limit) throws Exception {
        SQLiteDatabase d = getDb();
        try (Cursor c = d.query("song", SONG_COLS.split(","), where, args, null, null, orderBy, limit)) {
            return songsFromCursor(c);
        }
    }

    /** 搜索：支持歌名 / 拼音缩写 / 歌手名 */
    @ReactMethod
    public void searchSongs(String keyword, Promise promise) {
        queryExecutor.execute(() -> {
            try {
                String kw = keyword == null ? "" : keyword.trim();
                if (kw.isEmpty()) {
                    promise.resolve(Arguments.createArray());
                    return;
                }
                String like = "%" + kw + "%";
                String up = kw.toUpperCase();
                String likeUp = "%" + up + "%";
                WritableArray arr = querySongs(
                        "status = 1 AND (name LIKE ? OR singer_names LIKE ? OR acronym LIKE ?)",
                        new String[]{like, like, likeUp},
                        "temperature DESC",
                        String.valueOf(SEARCH_LIMIT));
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("SEARCH_FAILED", e.getMessage(), e);
            }
        });
    }

    /** 热门推荐：按热度倒序 */
    @ReactMethod
    public void getHotSongs(int page, Promise promise) {
        queryExecutor.execute(() -> {
            try {
                int offset = Math.max(0, page - 1) * PAGE_SIZE;
                WritableArray arr = querySongs("status = 1",
                        null, "temperature DESC", offset + "," + PAGE_SIZE);
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("HOT_FAILED", e.getMessage(), e);
            }
        });
    }

    /** 按类型（type_id）分页查询 */
    @ReactMethod
    public void getSongsByType(int typeId, int page, Promise promise) {
        queryExecutor.execute(() -> {
            try {
                int offset = Math.max(0, page - 1) * PAGE_SIZE;
                WritableArray arr = querySongs("status = 1 AND type_id = ?",
                        new String[]{String.valueOf(typeId)},
                        "temperature DESC",
                        offset + "," + PAGE_SIZE);
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("TYPE_FAILED", e.getMessage(), e);
            }
        });
    }

    /** 按歌手名分页查询 */
    @ReactMethod
    public void getSongsBySinger(String singer, int page, Promise promise) {
        queryExecutor.execute(() -> {
            try {
                if (singer == null || singer.trim().isEmpty()) {
                    promise.resolve(Arguments.createArray());
                    return;
                }
                int offset = Math.max(0, page - 1) * PAGE_SIZE;
                WritableArray arr = querySongs(
                        "status = 1 AND singer_names LIKE ?",
                        new String[]{"%" + singer.trim() + "%"},
                        "temperature DESC",
                        offset + "," + PAGE_SIZE);
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("SINGER_FAILED", e.getMessage(), e);
            }
        });
    }

    /** 按点歌号精确查询单曲 */
    @ReactMethod
    public void getSongByNumber(double number, Promise promise) {
        queryExecutor.execute(() -> {
            try {
                WritableArray arr = querySongs("number = ?",
                        new String[]{String.valueOf((long) number)},
                        null, "1");
                if (arr.size() > 0) promise.resolve(arr.getMap(0));
                else promise.resolve(null);
            } catch (Throwable e) {
                promise.reject("NUMBER_FAILED", e.getMessage(), e);
            }
        });
    }

    // ================= 歌手 =================

    /** 歌手列表：letter 为空返回全部热门，否则按拼音首字母过滤 */
    @ReactMethod
    public void getSingers(String letter, Promise promise) {
        queryExecutor.execute(() -> {
            try {
                String where;
                String[] args;
                if (letter == null || letter.trim().isEmpty()) {
                    where = "1 = 1";
                    args = null;
                } else {
                    where = "acronym LIKE ?";
                    args = new String[]{letter.trim().toUpperCase() + "%"};
                }
                SQLiteDatabase d = getDb();
                WritableArray arr = Arguments.createArray();
                try (Cursor c = d.query("singer",
                        new String[]{"id", "name", "acronym", "form_id", "region_id"},
                        where, args, null, null,
                        "CASE WHEN form_id IS NULL THEN 3 ELSE form_id END, acronym ASC",
                        "500")) {
                    while (c.moveToNext()) {
                        WritableMap m = Arguments.createMap();
                        m.putInt("id", c.getInt(0));
                        m.putString("name", c.getString(1));
                        m.putString("acronym", c.getString(2));
                        m.putInt("formId", c.getInt(3));
                        m.putInt("regionId", c.getInt(4));
                        arr.pushMap(m);
                    }
                }
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("SINGERS_FAILED", e.getMessage(), e);
            }
        });
    }

    // ================= 分类 =================

    /** 返回分类树：category -> types[] */
    @ReactMethod
    public void getCategories(Promise promise) {
        queryExecutor.execute(() -> {
            try {
                SQLiteDatabase d = getDb();
                WritableArray arr = Arguments.createArray();
                try (Cursor cats = d.query("song_category",
                        new String[]{"id", "name"}, null, null, null, null, "id ASC")) {
                    while (cats.moveToNext()) {
                        int cid = cats.getInt(0);
                        WritableMap cat = Arguments.createMap();
                        cat.putInt("id", cid);
                        cat.putString("name", cats.getString(1));
                        WritableArray types = Arguments.createArray();
                        try (Cursor ts = d.query("song_type",
                                new String[]{"id", "name"}, "category_id = ?",
                                new String[]{String.valueOf(cid)}, null, null, "id ASC")) {
                            while (ts.moveToNext()) {
                                WritableMap t = Arguments.createMap();
                                t.putInt("id", ts.getInt(0));
                                t.putString("name", ts.getString(1));
                                types.pushMap(t);
                            }
                        }
                        cat.putArray("types", types);
                        arr.pushMap(cat);
                    }
                }
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("CATEGORIES_FAILED", e.getMessage(), e);
            }
        });
    }

    /** 语种列表 */
    @ReactMethod
    public void getLanguages(Promise promise) {
        queryExecutor.execute(() -> {
            try {
                SQLiteDatabase d = getDb();
                WritableArray arr = Arguments.createArray();
                try (Cursor c = d.query("song_language",
                        new String[]{"id", "name"}, null, null, null, null, "id ASC")) {
                    while (c.moveToNext()) {
                        WritableMap m = Arguments.createMap();
                        m.putInt("id", c.getInt(0));
                        m.putString("name", c.getString(1));
                        arr.pushMap(m);
                    }
                }
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("LANGUAGES_FAILED", e.getMessage(), e);
            }
        });
    }

    /** 按语种分页查询 */
    @ReactMethod
    public void getSongsByLanguage(int languageId, int page, Promise promise) {
        queryExecutor.execute(() -> {
            try {
                int offset = Math.max(0, page - 1) * PAGE_SIZE;
                WritableArray arr = querySongs("status = 1 AND language_id = ?",
                        new String[]{String.valueOf(languageId)},
                        "temperature DESC",
                        offset + "," + PAGE_SIZE);
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("LANG_SONGS_FAILED", e.getMessage(), e);
            }
        });
    }

    /** 歌手形式（男/女/组合） */
    @ReactMethod
    public void getSingerForms(Promise promise) {
        queryExecutor.execute(() -> {
            try {
                SQLiteDatabase d = getDb();
                WritableArray arr = Arguments.createArray();
                try (Cursor c = d.query("singer_form",
                        new String[]{"id", "name"}, null, null, null, null, "id ASC")) {
                    while (c.moveToNext()) {
                        WritableMap m = Arguments.createMap();
                        m.putInt("id", c.getInt(0));
                        m.putString("name", c.getString(1));
                        arr.pushMap(m);
                    }
                }
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("FORMS_FAILED", e.getMessage(), e);
            }
        });
    }

    /** 歌手地区（大陆/港台/国外） */
    @ReactMethod
    public void getSingerRegions(Promise promise) {
        queryExecutor.execute(() -> {
            try {
                SQLiteDatabase d = getDb();
                WritableArray arr = Arguments.createArray();
                try (Cursor c = d.query("singer_region",
                        new String[]{"id", "name"}, null, null, null, null, "id ASC")) {
                    while (c.moveToNext()) {
                        WritableMap m = Arguments.createMap();
                        m.putInt("id", c.getInt(0));
                        m.putString("name", c.getString(1));
                        arr.pushMap(m);
                    }
                }
                promise.resolve(arr);
            } catch (Throwable e) {
                promise.reject("REGIONS_FAILED", e.getMessage(), e);
            }
        });
    }
}
