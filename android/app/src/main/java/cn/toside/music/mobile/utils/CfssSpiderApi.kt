package cn.toside.music.mobile.utils

import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * KTV 网络请求工具类
 * 同步请求方法，直接阻塞当前线程返回结果
 * 调用方必须在后台线程中调用
 */
class CfssSpiderApi {

    companion object {
        private const val CONNECT_TIMEOUT = 5L
        private const val READ_TIMEOUT = 10L
        private const val WRITE_TIMEOUT = 5L
    }

    // 单例OkHttpClient，共享连接池
    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT, TimeUnit.SECONDS)
            .writeTimeout(WRITE_TIMEOUT, TimeUnit.SECONDS)
            .build()
    }

    /**
     * 同步获取歌手列表（必须在后台线程调用）
     */
    fun singersSync(gender: Int): String {
        return syncRequest("singers", mapOf("gender" to gender.toString()))
    }

    /**
     * 同步获取歌曲列表（必须在后台线程调用）
     */
    fun songsSync(keyword: String, page: Int): String {
        return syncRequest("songs", mapOf("keyword" to keyword, "page" to page.toString()))
    }

    /**
     * 同步搜索（必须在后台线程调用）
     */
    fun searchSync(keyword: String): String {
        return syncRequest("search", mapOf("keyword" to keyword))
    }

    /**
     * 同步获取播放地址（必须在后台线程调用）
     */
    fun playerSync(id: String): String {
        return syncRequest("player", mapOf("id" to id))
    }

    /**
     * 同步获取歌手头像（必须在后台线程调用）
     */
    fun singerAvatarSync(name: String): String {
        return syncRequest("singerAvatar", mapOf("name" to name))
    }

    /**
     * 同步执行网络请求（内部阻塞，必须在后台线程调用）
     */
    private fun syncRequest(method: String, params: Map<String, String>): String {
        try {
            val url = buildUrl(method, params)
            val request = Request.Builder().url(url).build()
            val response = client.newCall(request).execute()
            return response.body?.string() ?: "{\"error\":\"空响应\"}"
        } catch (e: IOException) {
            return "{\"error\":\"${e.message}\"}"
        } catch (e: Exception) {
            return "{\"error\":\"${e.message}\"}"
        }
    }

    private fun buildUrl(method: String, params: Map<String, String>): String {
        val baseUrl = "https://cfss.cc/mv/$method"
        val query = params.entries.joinToString("&") { "${it.key}=${it.value}" }
        return "$baseUrl?$query"
    }
}
