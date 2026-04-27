const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// yyyy-mm-dd → yyyymmdd 변환
function toApiDate(dateStr) {
  return dateStr.replace(/-/g, "");
}

export async function fetchDashboardRecords(startDate, endDate) {
  const fromdd = toApiDate(startDate);
  const todd   = toApiDate(endDate);

  const res = await fetch(
    `${API_URL}/dashboard?fromdd=${fromdd}&todd=${todd}`,
    { headers: getHeaders() }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("대시보드 데이터 조회 실패:", data.message);
    return { records: [], lastCollectedAt: null };
  }

  return {
    records: data.data,
    lastCollectedAt: data.lastCollectedAt,
  };
}