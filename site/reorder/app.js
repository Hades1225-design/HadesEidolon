document.getElementById('save-remote').onclick = async () => {
  // 無論 TXT 或 JSON 模式，一律轉成標準 JSON 陣列
  const data = (MODE === 'json')
    ? RAW_JSON
    : ITEMS.map(text => ({ text }));

  const payload = {
    path: TARGET_PATH,
    content: JSON.stringify(data, null, 2),
    message: "chore: update data.json via reorder web ui"
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || out.detail || "unknown error");
    alert("✅ 已儲存成功！Commit: " + out.commit);
  } catch (e) {
    alert("❌ 儲存失敗：" + e.message);
  }
};