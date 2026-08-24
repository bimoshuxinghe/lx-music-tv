package cn.toside.music.mobile.ktv

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.VideoView
import androidx.fragment.app.Fragment
import cn.toside.music.mobile.R

/**
 * 原生KTV全屏播放Fragment
 * 使用VideoView，不显示控制条，不显示遥控器焦点框
 */
class KtvPlayerFragment : Fragment() {

    private var videoUri: String? = null
    private lateinit var videoView: VideoView

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_ktv_player, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        videoView = view.findViewById(R.id.video_view)

        // 禁用VideoView焦点，避免TV遥控器聚焦时显示白色焦点框
        videoView.isFocusable = false
        videoView.isFocusableInTouchMode = false
        videoView.defaultFocusHighlightEnabled = false
        // 焦点落在根布局上，根布局不显示焦点高亮
        view.defaultFocusHighlightEnabled = false
        view.isFocusableInTouchMode = true
        view.requestFocus()
    }

    fun playVideo(uri: String) {
        videoUri = uri
        videoView.setVideoURI(Uri.parse(uri))
        videoView.start()
    }

    fun pause() {
        if (videoView.isPlaying) videoView.pause()
    }

    fun resume() {
        if (!videoView.isPlaying) videoView.start()
    }

    fun isPlaying(): Boolean = videoView.isPlaying

    override fun onDestroyView() {
        videoView.suspend()
        super.onDestroyView()
    }
}
