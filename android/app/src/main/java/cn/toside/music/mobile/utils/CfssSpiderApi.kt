package cn.toside.music.mobile.utils

import android.os.Handler
import android.os.Looper
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * KTV 网络请求工具类
 * 使用OkHttp异步请求，避免阻塞主线程
 */
class CfssSpiderApi {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    /**
     * 同步执行网络请求（内部使用后台线程）
     */
    fun singers(gender: Int): String {
        return synchronousRequest("singers", mapOf("gender" to gender.toString()))
    }

    fun songs(keyword: String, page: Int): String {
        return synchronousRequest("songs", mapOf("keyword" to keyword, "page" to page.toString()))
    }

    fun search(keyword: String): String {
        return synchronousRequest("search", mapOf("keyword" to keyword))
    }

    fun player(id: String): String {
        return synchronousRequest("player", mapOf("id" to id))
    }

    fun singerAvatar(name: String): String {
        return synchronousRequest("singerAvatar", mapOf("name" to name))
    }

    private fun synchronousRequest(method: String, params: Map<String, String>): String {
        val result = arrayOfNullRef<String>(1)
        val lock = Any()

        Thread {
            synchronized(lock) {
                try {
                    val url = buildUrl(method, params)
                    val request = Request.Builder().url(url).build()

                    client.newCall(request).enqueue(object : Callback {
                        override fun onFailure(call: Call, e: IOException) {
                            synchronized(lock) {
                                result[0] = "{\"error\":\"${e.message}\"}"
                                lock.notify()
                            }
                        }

                        override fun onResponse(call: Call, response: okhttp3.Response) {
                            response.use {
                                val body = it.body?.string() ?: ""
                                synchronized(lock) {
                                    result[0] = body
                                    lock.notify()
                                }
                            }
                        }
                    })

                    lock.wait()
                } catch (e: Exception) {
                    synchronized(lock) {
                        result[0] = "{\"error\":\"${e.message}\"}"
                        lock.notify()
                    }
                }
            }
        }.start()

        synchronized(lock) {
            lock.wait()
        }

        return result[0] ?: "{\"error\":\"请求失败\"}"
    }

    private fun buildUrl(method: String, params: Map<String, String>): String {
        val baseUrl = "https://cfss.cc/mv/$method"
        val query = params.entries.joinToString("&") { "${it.key}=${it.value}" }
        return "$baseUrl?$query"
    }

    companion object {
        @Suppress("UNCHECKED_CAST")
        private fun <T> arrayOfNullRef(size: Int): Array<T?> {
            return arrayOfNulls(size)
        }
    }
}
