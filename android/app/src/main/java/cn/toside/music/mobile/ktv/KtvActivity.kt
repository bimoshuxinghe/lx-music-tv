package cn.toside.music.mobile.ktv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.FragmentTransaction
import cn.toside.music.mobile.R
import cn.toside.music.mobile.utils.CfssSpiderApi
import com.facebook.react.ReactInstanceManager
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * 原生KTV主Activity
 * 完全用原生View实现，绕过RN的JS线程性能瓶颈
 */
class KtvActivity : AppCompatActivity() {

    private var currentTab = 0 // 0=singer, 1=song, 2=search
    private var selectedSinger: String? = null
    private var playerFragment: KtvPlayerFragment? = null
    private var isPlaying = false
    private var isMenuVisible = false
    
    private val cfssApi = CfssSpiderApi()
    
    // 按键事件接收器
    private val keyEventReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val keyCode = intent?.getIntExtra("keyCode", -1) ?: return
            handleNativeKeyCode(keyCode)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ktv)
        
        // 保持屏幕常亮
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        // 注册按键监听
        val filter = IntentFilter("cn.toside.music.mobile.ktv.KEY_EVENT")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(keyEventReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(keyEventReceiver, filter)
        }
        
        // 初始化UI
        setupViews()
        
        // 显示加载状态
        findViewById<TextView>(R.id.txt_loading).visibility = View.VISIBLE
        
        // 延迟加载初始数据，避免界面闪烁
        findViewById<TextView>(R.id.txt_loading).visibility = View.GONE
        loadSingerList(1) // 默认男歌手
    }

    private fun setupViews() {
        // Tab切换
        findViewById<TextView>(R.id.txt_tab_singer).setOnClickListener { switchTab(0) }
        findViewById<TextView>(R.id.txt_tab_female).setOnClickListener { switchTab(0) }
        findViewById<TextView>(R.id.txt_tab_song).setOnClickListener { switchTab(1) }
        findViewById<TextView>(R.id.txt_tab_search).setOnClickListener { switchTab(2) }
        
        // 返回键
        findViewById<View>(R.id.btn_back).setOnClickListener { onBackPressed() }
    }

    private fun switchTab(tab: Int) {
        currentTab = tab
        // 更新Tab样式
        val tabs = listOf(R.id.txt_tab_singer, R.id.txt_tab_female, R.id.txt_tab_song, R.id.txt_tab_search)
        tabs.forEachIndexed { index, id ->
            findViewById<TextView>(id).isSelected = index == tab
        }
        
        // 加载对应内容
        when (tab) {
            0 -> loadSingerList(if (selectedSinger == null) 1 else 2)
            1 -> loadSongList()
            2 -> {} // 搜索功能待实现
        }
    }

    private fun loadSingerList(gender: Int) {
        findViewById<ProgressBar>(R.id.progressBar).visibility = View.VISIBLE
        Thread {
            try {
                val json = cfssApi.singers(gender)
                val singers = parseSingerJson(json)
                runOnUiThread {
                    findViewById<ProgressBar>(R.id.progressBar).visibility = View.GONE
                    if (singers.isNotEmpty()) {
                        showSingerFragment(singers)
                    } else {
                        findViewById<TextView>(R.id.txt_error).text = "歌手列表为空"
                        findViewById<TextView>(R.id.txt_error).visibility = View.VISIBLE
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    findViewById<ProgressBar>(R.id.progressBar).visibility = View.GONE
                    findViewById<TextView>(R.id.txt_error).text = "加载失败: ${e.message}"
                    findViewById<TextView>(R.id.txt_error).visibility = View.VISIBLE
                }
            }
        }.start()
    }

    private fun loadSongList() {
        findViewById<ProgressBar>(R.id.progressBar).visibility = View.VISIBLE
        Thread {
            try {
                val json = cfssApi.songs("", 1)
                val songs = parseMvJson(json)
                runOnUiThread {
                    findViewById<ProgressBar>(R.id.progressBar).visibility = View.GONE
                    if (songs.isNotEmpty()) {
                        showSongFragment(songs)
                    } else {
                        findViewById<TextView>(R.id.txt_error).text = "歌曲列表为空"
                        findViewById<TextView>(R.id.txt_error).visibility = View.VISIBLE
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    findViewById<ProgressBar>(R.id.progressBar).visibility = View.GONE
                    findViewById<TextView>(R.id.txt_error).text = "加载失败: ${e.message}"
                    findViewById<TextView>(R.id.txt_error).visibility = View.VISIBLE
                }
            }
        }.start()
    }

    fun onSingerSelected(singer: KtvSingerFragment.KtvSinger) {
        selectedSinger = singer.name
        loadSingerMvList(singer.name)
    }

    private fun loadSingerMvList(singerName: String) {
        findViewById<ProgressBar>(R.id.progressBar).visibility = View.VISIBLE
        Thread {
            try {
                val json = cfssApi.songs(singerName, 1)
                val mvList = parseMvJson(json)
                runOnUiThread {
                    findViewById<ProgressBar>(R.id.progressBar).visibility = View.GONE
                    if (mvList.isNotEmpty()) {
                        showMvFragment(mvList, singerName)
                    } else {
                        findViewById<TextView>(R.id.txt_error).text = "${singerName} 的歌曲列表为空"
                        findViewById<TextView>(R.id.txt_error).visibility = View.VISIBLE
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    findViewById<ProgressBar>(R.id.progressBar).visibility = View.GONE
                    findViewById<TextView>(R.id.txt_error).text = "加载失败: ${e.message}"
                    findViewById<TextView>(R.id.txt_error).visibility = View.VISIBLE
                }
            }
        }.start()
    }

    fun onMvSelected(mv: KtvMvFragment.KtvMvItem) {
        playMv(mv.id, mv.name)
    }

    private fun playMv(id: String, name: String) {
        Thread {
            try {
                val json = cfssApi.player(id)
                val url = parsePlayerUrl(json)
                runOnUiThread {
                    showPlayerFragment(url, name)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    findViewById<TextView>(R.id.txt_error).text = "播放失败: ${e.message}"
                }
            }
        }.start()
    }

    private fun showSingerFragment(singers: List<KtvSingerFragment.KtvSinger>) {
        val fragment = KtvSingerFragment()
        fragment.updateList(singers)
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }

    private fun showSongFragment(songs: List<KtvMvFragment.KtvMvItem>) {
        val fragment = KtvMvFragment()
        fragment.updateList(songs)
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }

    private fun showMvFragment(mvs: List<KtvMvFragment.KtvMvItem>, singerName: String) {
        selectedSinger = singerName
        val fragment = KtvMvFragment()
        fragment.updateList(mvs)
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }

    private fun showPlayerFragment(url: String, name: String) {
        val fragment = KtvPlayerFragment()
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
        // 延迟播放确保fragment已显示
        supportFragmentManager.executePendingTransactions()
        (supportFragmentManager.findFragmentById(R.id.fragment_container) as? KtvPlayerFragment)?.playVideo(url)
    }

    // 处理原生按键
    private fun handleNativeKeyCode(keyCode: Int) {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> {
                // 上一曲
                playPrevious()
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                // 下一曲
                playNext()
            }
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                // 暂停/播放
                togglePlay()
            }
            KeyEvent.KEYCODE_MENU -> {
                // 显示/隐藏菜单
                toggleMenu()
            }
        }
    }

    private fun togglePlay() {
        if (playerFragment == null) return
        if (playerFragment!!.isPlaying()) {
            playerFragment!!.pause()
            isPlaying = false
        } else {
            playerFragment!!.resume()
            isPlaying = true
        }
    }

    private fun playPrevious() {
        // TODO: 实现上一曲逻辑
    }

    private fun playNext() {
        // TODO: 实现下一曲逻辑
    }

    private fun toggleMenu() {
        isMenuVisible = !isMenuVisible
        // TODO: 显示/隐藏歌曲选择菜单
    }

    // JSON解析
    private fun parseSingerJson(json: String): List<KtvSingerFragment.KtvSinger> {
        val result = mutableListOf<KtvSingerFragment.KtvSinger>()
        try {
            val obj = org.json.JSONObject(json)
            val list = obj.getJSONArray("list")
            for (i in 0 until list.length()) {
                val item = list.getJSONObject(i)
                result.add(KtvSingerFragment.KtvSinger(
                    id = item.getString("vod_id"),
                    name = item.getString("vod_name"),
                    avatarUrl = item.optString("vod_pic", "")
                ))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return result
    }

    private fun parseMvJson(json: String): List<KtvMvFragment.KtvMvItem> {
        val result = mutableListOf<KtvMvFragment.KtvMvItem>()
        try {
            val obj = org.json.JSONObject(json)
            val list = obj.getJSONArray("list")
            for (i in 0 until list.length()) {
                val item = list.getJSONObject(i)
                result.add(KtvMvFragment.KtvMvItem(
                    id = item.getString("vod_id"),
                    name = item.getString("vod_name"),
                    thumbUrl = item.optString("vod_pic", ""),
                    duration = item.optString("vod_remarks", "")
                ))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return result
    }

    private fun parsePlayerUrl(json: String): String {
        try {
            val obj = org.json.JSONObject(json)
            return obj.getString("url")
        } catch (e: Exception) {
            throw RuntimeException("解析播放地址失败", e)
        }
    }

    override fun onDestroy() {
        unregisterReceiver(keyEventReceiver)
        playerFragment?.onDestroyView()
        super.onDestroy()
    }

    companion object {
        const val ACTION_START_KTV = "cn.toside.music.mobile.ktv.ACTION_START_KTV"
        
        fun start(context: Context) {
            val intent = Intent(context, KtvActivity::class.java)
            intent.action = ACTION_START_KTV
            context.startActivity(intent)
        }
    }
}
