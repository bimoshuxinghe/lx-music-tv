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
 * 原生KTV MV列表Fragment
 */
class KtvMvFragment : Fragment() {

    private var mvList: List<KtvMvItem> = emptyList()
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: MvAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_ktv_mv, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        recyclerView = view.findViewById(R.id.recycler_mv_list)
        recyclerView.layoutManager = GridLayoutManager(context, 4)
        adapter = MvAdapter(mvList) { mvItem ->
            (activity as? KtvActivity)?.onMvSelected(mvItem)
        }
        recyclerView.adapter = adapter
    }

    fun updateList(list: List<KtvMvItem>) {
        mvList = list
        adapter.updateList(list)
    }

    class MvAdapter(
        private var mvList: List<KtvMvItem>,
        private val onItemClick: (KtvMvItem) -> Unit
    ) : RecyclerView.Adapter<MvAdapter.MvViewHolder>() {

        class MvViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val thumb: ImageView = view.findViewById(R.id.img_mv_thumb)
            val name: TextView = view.findViewById(R.id.txt_mv_name)
            val duration: TextView = view.findViewById(R.id.txt_mv_duration)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MvViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_mv, parent, false)
            return MvViewHolder(view)
        }

        override fun onBindViewHolder(holder: MvViewHolder, position: Int) {
            val mv = mvList[position]
            holder.name.text = mv.name
            holder.duration.text = mv.duration
            if (mv.thumbUrl.isNotEmpty()) {
                Glide.with(holder.thumb.context)
                    .load(mv.thumbUrl)
                    .placeholder(R.drawable.ic_movie_placeholder)
                    .error(R.drawable.ic_movie_placeholder)
                    .into(holder.thumb)
            } else {
                holder.thumb.setImageResource(R.drawable.ic_movie_placeholder)
            }
            holder.itemView.setOnClickListener { onItemClick(mv) }
        }

        override fun getItemCount() = mvList.size

        fun updateList(list: List<KtvMvItem>) {
            mvList = list
            notifyDataSetChanged()
        }
    }

    data class KtvMvItem(val id: String, val name: String, val thumbUrl: String = "", val duration: String = "")
}
