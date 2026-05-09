use serde::Serialize;
use std::fs;
use std::sync::Mutex;
use tauri::State;

#[derive(Clone)]
struct CpuSample {
    total: u64,
    idle: u64,
}

struct AppState {
    prev_cpu: Mutex<Option<CpuSample>>,
}

#[derive(Serialize)]
struct SystemStats {
    cpu_usage_percent: f32,
    cpu_temp_celsius: f32,
    mem_total_mb: f32,
    mem_available_mb: f32,
    mem_used_mb: f32,
    mem_extended_mb: f32,
}

fn read_cpu_usage(prev: &Option<CpuSample>) -> (f32, CpuSample) {
    let content = match fs::read_to_string("/proc/stat") {
        Ok(c) => c,
        Err(_) => return (-1.0, CpuSample { total: 0, idle: 0 }),
    };

    let line = match content.lines().next() {
        Some(l) => l,
        None => return (-1.0, CpuSample { total: 0, idle: 0 }),
    };

    let nums: Vec<u64> = line
        .split_whitespace()
        .skip(1)
        .filter_map(|s| s.parse().ok())
        .collect();

    if nums.len() < 4 {
        return (-1.0, CpuSample { total: 0, idle: 0 });
    }

    let idle = nums[3];
    let total: u64 = nums.iter().sum();
    let sample = CpuSample { total, idle };

    let usage = match prev {
        Some(p) => {
            let dtotal = total.saturating_sub(p.total) as f32;
            let didle = idle.saturating_sub(p.idle) as f32;
            if dtotal > 0.0 {
                ((dtotal - didle) / dtotal * 100.0).clamp(0.0, 100.0)
            } else {
                -1.0
            }
        }
        None => -1.0,
    };

    (usage, sample)
}

fn read_cpu_temp() -> f32 {
    for i in 0..10 {
        let path = format!("/sys/class/thermal/thermal_zone{}/temp", i);
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(v) = raw.trim().parse::<f32>() {
                let temp = if v > 1000.0 { v / 1000.0 } else { v };
                if temp > 0.0 && temp < 150.0 {
                    return temp;
                }
            }
        }
    }
    -1.0
}

fn read_meminfo() -> (f32, f32, f32, f32) {
    let content = match fs::read_to_string("/proc/meminfo") {
        Ok(c) => c,
        Err(_) => return (0.0, 0.0, 0.0, 0.0),
    };

    let mut total_kb = 0u64;
    let mut avail_kb = 0u64;
    let mut swap_total_kb = 0u64;

    for line in content.lines() {
        let mut parts = line.splitn(2, ':');
        let key = parts.next().unwrap_or("").trim();
        let val_str = parts.next().unwrap_or("").trim();
        let val: u64 = val_str
            .split_whitespace()
            .next()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        match key {
            "MemTotal" => total_kb = val,
            "MemAvailable" => avail_kb = val,
            "SwapTotal" => swap_total_kb = val,
            _ => {}
        }
    }

    let total_mb = total_kb as f32 / 1024.0;
    let avail_mb = avail_kb as f32 / 1024.0;
    let used_mb = total_mb - avail_mb;
    let ext_mb = swap_total_kb as f32 / 1024.0;

    (total_mb, avail_mb, used_mb, ext_mb)
}

#[tauri::command]
fn get_system_stats(state: State<'_, AppState>) -> SystemStats {
    let mut prev_lock = state.prev_cpu.lock().unwrap();
    let (cpu_usage, sample) = read_cpu_usage(&*prev_lock);
    *prev_lock = Some(sample);
    drop(prev_lock);

    let cpu_temp = read_cpu_temp();
    let (mem_total, mem_avail, mem_used, mem_ext) = read_meminfo();

    SystemStats {
        cpu_usage_percent: cpu_usage,
        cpu_temp_celsius: cpu_temp,
        mem_total_mb: mem_total,
        mem_available_mb: mem_avail,
        mem_used_mb: mem_used,
        mem_extended_mb: mem_ext,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            prev_cpu: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![get_system_stats])
        .run(tauri::generate_context!())
        .expect("error running app");
}
