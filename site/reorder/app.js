try {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: TARGET_PATH,                              // 應為 "public/data.json"
      content: JSON.stringify(
        MODE === 'json' ? RAW_JSON : ITEMS.map(t => ({ text: t })), 
        null, 2
      ),
      message: "chore: update data.json via web ui"
    })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert("❌ 儲存失敗\nstatus: " + res.status + "\n" + (out.github_raw || out.error || out.detail || ''));
    return;
  }
  alert("✅ 成功！commit: " + (out.commit || '—'));
} catch (e) {
  alert("❌ 連線失敗：" + e.message);
}