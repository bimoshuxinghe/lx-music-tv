package cn.toside.music.mobile.ktv

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.GridLayoutManager
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import cn.toside.music.mobile.R

/**
 * 原生KTV歌手列表Fragment
 * 替代RN FlatList，使用RecyclerView提高性能
 */
class KtvSingerFragment : Fragment() {

    private var singerList: List<KtvSinger> = emptyList()
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: SingerAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_ktv_singer, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        recyclerView = view.findViewById(R.id.recycler_singers)
        recyclerView.layoutManager = GridLayoutManager(requireContext(), 6)
        adapter = SingerAdapter(singerList) { singer ->
            (activity as? KtvActivity)?.onSingerSelected(singer)
        }
        recyclerView.adapter = adapter
    }

    fun updateList(list: List<KtvSinger>) {
        singerList = list
        adapter.updateList(list)
    }

    class SingerAdapter(
        private var singers: List<KtvSinger>,
        private val onItemClick: (KtvSinger) -> Unit
    ) : RecyclerView.Adapter<SingerAdapter.SingerViewHolder>() {

        class SingerViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val avatar: ImageView = view.findViewById(R.id.img_singer_avatar)
            val name: TextView = view.findViewById(R.id.txt_singer_name)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SingerViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_singer, parent, false)
            return SingerViewHolder(view)
        }

        override fun onBindViewHolder(holder: SingerViewHolder, position: Int) {
            val singer = singers[position]
            holder.name.text = singer.name
            if (singer.avatarUrl.isNotEmpty()) {
                Glide.with(holder.avatar.context)
                    .load(singer.avatarUrl)
                    .placeholder(R.drawable.ic_person_placeholder)
                    .error(R.drawable.ic_person_placeholder)
                    .into(holder.avatar)
            } else {
                holder.avatar.setImageResource(R.drawable.ic_person_placeholder)
            }
            holder.itemView.setOnClickListener { onItemClick(singer) }
        }

        override fun getItemCount() = singers.size

        fun updateList(list: List<KtvSinger>) {
            singers = list
            notifyDataSetChanged()
        }
    }

    data class KtvSinger(val id: String, val name: String, val avatarUrl: String = "")
}
