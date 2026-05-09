package com.sysmonitor.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.io.File

class StatsWidget : AppWidgetProvider() {

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateWidget(ctx, mgr, it) }
    }

    override fun onReceive(ctx: Context, intent: Intent) {
        super.onReceive(ctx, intent)
        if (intent.action == ACTION_REFRESH) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, StatsWidget::class.java))
            ids.forEach { updateWidget(ctx, mgr, it) }
        }
    }

    private fun updateWidget(ctx: Context, mgr: AppWidgetManager, id: Int) {
        val views = RemoteViews(ctx.packageName, R.layout.widget_stats)

        val memInfo = readMemInfo()
        val temp = readCpuTemp()

        val totalMb = memInfo.first
        val usedMb = memInfo.second
        val extMb = memInfo.third
        val pct = if (totalMb > 0) ((usedMb.toFloat() / totalMb) * 100).toInt() else 0

        views.setTextViewText(R.id.widget_mem_pct, "$pct%")
        views.setTextViewText(
            R.id.widget_mem_detail,
            "${fmtMB(usedMb)} / ${fmtMB(totalMb)}"
        )
        views.setTextViewText(
            R.id.widget_cpu_temp,
            if (temp >= 0f) "%.1f°C".format(temp) else "N/A"
        )
        if (extMb > 0) {
            views.setTextViewText(R.id.widget_ext_mem, "+${fmtMB(extMb)} vRAM")
        } else {
            views.setTextViewText(R.id.widget_ext_mem, "")
        }

        val intent = Intent(ctx, StatsWidget::class.java).apply {
            action = ACTION_REFRESH
        }
        val pi = PendingIntent.getBroadcast(
            ctx, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, pi)

        mgr.updateAppWidget(id, views)
    }

    companion object {
        const val ACTION_REFRESH = "com.sysmonitor.app.WIDGET_UPDATE"

        private fun readMemInfo(): Triple<Long, Long, Long> {
            var total = 0L; var avail = 0L; var swap = 0L
            try {
                File("/proc/meminfo").forEachLine { line ->
                    val parts = line.split(Regex("\\s+"))
                    val kb = parts.getOrNull(1)?.toLongOrNull() ?: 0L
                    when {
                        line.startsWith("MemTotal") -> total = kb / 1024
                        line.startsWith("MemAvailable") -> avail = kb / 1024
                        line.startsWith("SwapTotal") -> swap = kb / 1024
                    }
                }
            } catch (_: Exception) {}
            return Triple(total, total - avail, swap)
        }

        private fun readCpuTemp(): Float {
            for (i in 0..9) {
                try {
                    val raw = File("/sys/class/thermal/thermal_zone$i/temp")
                        .readText().trim().toFloatOrNull() ?: continue
                    val t = if (raw > 1000f) raw / 1000f else raw
                    if (t in 0f..150f) return t
                } catch (_: Exception) {}
            }
            return -1f
        }

        private fun fmtMB(mb: Long): String =
            if (mb >= 1024) "%.1f GB".format(mb / 1024f) else "$mb MB"
    }
}
