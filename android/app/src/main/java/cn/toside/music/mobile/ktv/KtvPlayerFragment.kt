package cn.toside.music.mobile.ktv

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.MediaController
import android.widget.VideoView
import androidx.fragment.app.Fragment
import cn.toside.music.mobile.R

/**
 * 原生KTV全屏播放Fragment
 * 使用VideoView + MediaController，响应式控制条
 */
class KtvPlayerFragment : Fragment() {

    private var videoUri: String? = null
    private var mediaController: MediaController? = null
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
        mediaController = MediaController(context)
        mediaController?.setAnchorView(videoView)
    }

    fun playVideo(uri: String) {
        videoUri = uri
        videoView.setVideoURI(Uri.parse(uri))
        videoView.setMediaController(mediaController)
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
        mediaController = null
        super.onDestroyView()
    }
}
