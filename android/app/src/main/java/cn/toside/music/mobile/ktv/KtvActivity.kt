package cn.toside.music.mobile.ktv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.FragmentTransaction
import cn.toside.music.mobile.R
import cn.toside.music.mobile.utils.CfssSpiderApi

/**
 * 原生KTV主Activity
 * 完全用原生View实现，绕过RN的JS线程性能瓶颈
 */
class KtvActivity : AppCompatActivity() {

    private var currentTab = 0
    private var selectedSinger: String? = null
    private var playerFragment: KtvPlayerFragment? = null
    private var isPlaying = false
    private var isMenuVisible = false
    
    private val cfssApi = CfssSpiderApi()
    private val mainHandler = Handler(Looper.getMainLooper())
    
    // 缓存View引用，避免重复findViewById
    private var progressBar: ProgressBar? = null
    private var txtError: TextView? = null
    private var txtLoading: TextView? = null
    
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
        
        // 隐藏系统导航栏和Cursor
        hideSystemUI()
        
        // 缓存View引用
        progressBar = findViewById(R.id.progressBar)
        txtError = findViewById(R.id.txt_error)
        txtLoading = findViewById(R.id.txt_loading)
        
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
        
        // 直接加载数据，不走RN
        loadInitialData()
    }

    private fun setupViews() {
        // Tab切换 - 使用直接View引用
        val tabSinger = findViewById<TextView>(R.id.txt_tab_singer)
        val tabFemale = findViewById<TextView>(R.id.txt_tab_female)
        val tabSong = findViewById<TextView>(R.id.txt_tab_song)
        val tabSearch = findViewById<TextView>(R.id.txt_tab_search)
        
        tabSinger.setOnClickListener { switchTab(0) }
        tabFemale.setOnClickListener { switchTab(0) }
        tabSong.setOnClickListener { switchTab(1) }
        tabSearch.setOnClickListener { switchTab(2) }
        
        // 返回键
        findViewById<View>(R.id.btn_back).setOnClickListener { onBackPressed() }
    }

    private fun loadInitialData() {
        showLoading()
        startLoadSingerList(1)
    }

    private fun switchTab(tab: Int) {
        currentTab = tab
        val tabs = listOf(R.id.txt_tab_singer, R.id.txt_tab_female, R.id.txt_tab_song, R.id.txt_tab_search)
        tabs.forEachIndexed { index, id ->
            findViewById<TextView>(id).isSelected = index == tab
        }
        
        when (tab) {
            0 -> {
                showLoading()
                startLoadSingerList(if (selectedSinger == null) 1 else 2)
            }
            1 -> {
                showLoading()
                startLoadSongList()
            }
            2 -> {}
        }
    }

    // ==================== 数据加载（异步）====================

    private fun startLoadSingerList(gender: Int) {
        Thread {
            try {
                val json = cfssApi.singersSync(gender)
                val singers = parseSingerJson(json)
                if (singers.isNotEmpty()) {
                    mainHandler.post { showSingerFragment(singers) }
                } else {
                    mainHandler.post { showError("歌手列表为空") }
                }
            } catch (e: Exception) {
                mainHandler.post { showError("加载失败: ${e.message}") }
            }
        }.start()
    }

    private fun startLoadSongList() {
        Thread {
            try {
                val json = cfssApi.songsSync("", 1)
                val songs = parseMvJson(json)
                if (songs.isNotEmpty()) {
                    mainHandler.post { showSongFragment(songs) }
                } else {
                    mainHandler.post { showError("歌曲列表为空") }
                }
            } catch (e: Exception) {
                mainHandler.post { showError("加载失败: ${e.message}") }
            }
        }.start()
    }

    // ==================== 用户操作回调 ====================

    fun onSingerSelected(singer: KtvSingerFragment.KtvSinger) {
        selectedSinger = singer.name
        showLoading()
        startLoadSingerMvList(singer.name)
    }

    private fun startLoadSingerMvList(singerName: String) {
        Thread {
            try {
                val json = cfssApi.songsSync(singerName, 1)
                val mvList = parseMvJson(json)
                if (mvList.isNotEmpty()) {
                    mainHandler.post { showMvFragment(mvList, singerName) }
                } else {
                    mainHandler.post { showError("${singerName} 的歌曲列表为空") }
                }
            } catch (e: Exception) {
                mainHandler.post { showError("加载失败: ${e.message}") }
            }
        }.start()
    }

    fun onMvSelected(mv: KtvMvFragment.KtvMvItem) {
        showLoading()
        startPlayMv(mv.id, mv.name)
    }

    private fun startPlayMv(id: String, name: String) {
        Thread {
            try {
                val json = cfssApi.playerSync(id)
                val url = parsePlayerUrl(json)
                mainHandler.post {
                    hideLoading()
                    showPlayerFragment(url, name)
                }
            } catch (e: Exception) {
                mainHandler.post { showError("播放失败: ${e.message}") }
            }
        }.start()
    }

    // ==================== UI 更新（直接操作）====================

    private fun showLoading() {
        progressBar?.visibility = View.VISIBLE
        txtError?.visibility = View.GONE
        txtLoading?.visibility = View.VISIBLE
    }

    private fun hideLoading() {
        progressBar?.visibility = View.GONE
        txtLoading?.visibility = View.GONE
    }

    private fun showError(msg: String) {
        progressBar?.visibility = View.GONE
        txtLoading?.visibility = View.GONE
        txtError?.text = msg
        txtError?.visibility = View.VISIBLE
    }

    /**
     * 隐藏系统UI（导航栏、状态栏等）
     */
    private fun hideSystemUI() {
        @Suppress("DEPRECATION")
        val decorView = window.decorView
        val uiOptions = (View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        decorView.systemUiVisibility = uiOptions
        
        // 隐藏导航栏
        val navBarHeight = resources.getDimensionPixelSize(
            resources.getIdentifier("navigation_bar_height", "dimen", "android"))
        if (navBarHeight > 0) {
            val params = window.attributes
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = params
        }
    }

    // ==================== Fragment 显示 ====================

    private fun showSingerFragment(singers: List<KtvSingerFragment.KtvSinger>) {
        val fragment = KtvSingerFragment()
        fragment.updateList(singers)
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commitAllowingStateLoss()
    }

    private fun showSongFragment(songs: List<KtvMvFragment.KtvMvItem>) {
        val fragment = KtvMvFragment()
        fragment.updateList(songs)
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commitAllowingStateLoss()
    }

    private fun showMvFragment(mvs: List<KtvMvFragment.KtvMvItem>, singerName: String) {
        selectedSinger = singerName
        val fragment = KtvMvFragment()
        fragment.updateList(mvs)
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commitAllowingStateLoss()
    }

    private fun showPlayerFragment(url: String, name: String) {
        val fragment = KtvPlayerFragment()
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commitAllowingStateLoss()
        supportFragmentManager.executePendingTransactions()
        (supportFragmentManager.findFragmentById(R.id.fragment_container) as? KtvPlayerFragment)?.playVideo(url)
    }

    // ==================== 按键处理 ====================

    private fun handleNativeKeyCode(keyCode: Int) {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> playPrevious()
            KeyEvent.KEYCODE_DPAD_DOWN -> playNext()
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> togglePlay()
            KeyEvent.KEYCODE_MENU -> toggleMenu()
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

    private fun playPrevious() {}
    private fun playNext() {}
    
    private fun toggleMenu() {
        isMenuVisible = !isMenuVisible
    }

    // ==================== JSON解析 ====================

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
