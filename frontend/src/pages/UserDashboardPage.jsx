import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  CircleHelp,
  ChevronDown,
  Clock3,
  Check,
  Download,
  LogOut,
  RefreshCcw,
  Search,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";  // sheetjs community fork. cell.s 스타일(wrapText 등) 적용 가능.
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clearAuth } from "../services/authService";
import { fetchDashboardRecords } from "../services/dashboardService";

const PERIOD_OPTIONS = [
  { key: "daily", label: "일간" },
  { key: "weekly", label: "주간" },
  { key: "monthly", label: "월간" },
  { key: "custom", label: "기간 선택" },
];

const COMMON_GRID =
  "grid-cols-[1.5fr_1fr_0.85fr_0.85fr_1.3fr_1fr_1fr_0.82fr_0.82fr_1.3fr]";

// 일간 + 교수별 보기 전용 12컬럼 그리드
// 진료과 / 교수명 / 실 세션 / 진료 시작·종료시간 / 평균 진료·대기시간 / 마감 요청시간·사유 / 초진·재진 / 예약현황 가동률
const DAILY_PROFESSOR_GRID =
  "grid-cols-[1.5fr_1fr_0.7fr_1fr_1fr_1fr_1fr_1fr_1.3fr_1fr_1fr_1.3fr]";

// 주간·월간 + 교수별 보기 전용 11컬럼 그리드 (기존 10컬럼에 '마감 건수' 추가)
const RANGE_PROFESSOR_GRID =
  "grid-cols-[1.5fr_1fr_0.85fr_0.85fr_1.3fr_1fr_1fr_0.85fr_0.82fr_0.82fr_1.3fr]";

const KST_TIME_ZONE = "Asia/Seoul";

const TREND_METRICS = [
  {
    key: "actualSessions",
    title: "실 세션",
    stroke: "#22d3ee",
    fill: "#0891b2",
    suffix: "건",
    decimals: 0,
  },
  {
    key: "sessionUtilization",
    title: "세션 가동률",
    stroke: "#60a5fa",
    fill: "#2563eb",
    suffix: "%",
    decimals: 1,
  },
  {
    key: "avgTreatmentMin",
    title: "평균 진료시간",
    stroke: "#a78bfa",
    fill: "#7c3aed",
    suffix: "분",
    decimals: 1,
  },
  {
    key: "avgWaitMin",
    title: "평균 대기시간",
    stroke: "#f472b6",
    fill: "#db2777",
    suffix: "분",
    decimals: 1,
  },
  {
    key: "firstVisitPatients",
    title: "초진(병초)",
    stroke: "#34d399",
    fill: "#059669",
    suffix: "명",
    decimals: 0,
  },
  {
    key: "bookingRate",
    title: "예약현황 가동률",
    stroke: "#f59e0b",
    fill: "#d97706",
    suffix: "%",
    decimals: 1,
  },
];

function getKstDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { year, month, day };
}

function toYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayKstString(date = new Date()) {
  const { year, month, day } = getKstDateParts(date);
  return toYmd(year, month, day);
}

function getStartOfWeekKstString(date = new Date()) {
  const { year, month, day } = getKstDateParts(date);

  const base = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = base.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  base.setUTCDate(base.getUTCDate() - diffToMonday);

  return toYmd(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

function getStartOfMonthKstString(date = new Date()) {
  const { year, month } = getKstDateParts(date);
  return toYmd(year, month, 1);
}

function createAggregateBucket(labelValue) {
  return {
    labelValue,
    professorSet: new Set(),
    plannedSessions: 0,
    actualSessions: 0,
    treatmentSum: 0,
    waitSum: 0,
    firstVisitPatients: 0,
    revisitPatients: 0,
    bookingSum: 0,
    count: 0,
  };
}

function getPeriodRange(periodType, customStart, customEnd, dailyDate) {
  const todayKst = getTodayKstString();
  const weekStartKst = getStartOfWeekKstString();
  const monthStartKst = getStartOfMonthKstString();

  if (periodType === "daily") {
    const target = dailyDate || todayKst;
    return { startDate: target, endDate: target };
  }

  if (periodType === "weekly") {
    return { startDate: weekStartKst, endDate: todayKst };
  }

  if (periodType === "monthly") {
    return { startDate: monthStartKst, endDate: todayKst };
  }

  return {
    startDate: customStart || todayKst,
    endDate: customEnd || todayKst,
  };
}

function sanitizeSheetName(name) {
  return name.replace(/[\\\/\?\*\[\]:]/g, "").slice(0, 31);
}

function getPeriodNameForExport(periodType, startDate, endDate) {
  if (periodType === "daily") return `일간_${startDate}`;
  if (periodType === "weekly") return `주간_${startDate}-${endDate}`;
  if (periodType === "monthly") return `월간_${startDate.slice(0, 7)}`;
  return `기간_${startDate}-${endDate}`;
}

function getViewName(activeView) {
  return activeView === "department" ? "진료과별현황" : "교수별현황";
}

function buildSheetName(activeView, periodType, startDate, endDate) {
  return sanitizeSheetName(
    `${getViewName(activeView)}_${getPeriodNameForExport(periodType, startDate, endDate)}`
  );
}

function buildFileName(activeView, periodType, startDate, endDate) {
  return `${getViewName(activeView)}_${getPeriodNameForExport(periodType, startDate, endDate)}.xlsx`;
}

// 엑셀 wch 단위는 영문 1글자 기준. 한글/한자는 영문보다 약 2배 넓으니 그대로 계산하면 셀이 좁아짐.
// 동아시아 문자(U+1100 이상의 한글/한자/일본어/전각기호 등)는 너비 2로 환산.
function displayWidth(s) {
  let w = 0;
  for (const ch of s) {
    w += (ch.codePointAt(0) ?? 0) >= 0x1100 ? 2 : 1;
  }
  return w;
}

function getColumnWidthsFromRows(rows) {
  if (!rows.length) return [];

  const keys = Object.keys(rows[0]);

  return keys.map((key) => {
    const headerWidth = displayWidth(String(key));
    const maxValueWidth = rows.reduce((max, row) => {
      const text = String(row[key] ?? "");
      // 멀티라인 셀(마감 상세 등)은 가장 긴 한 줄 폭으로 잡아야 다른 줄도 다 들어감
      const longestLine = text.split("\n").reduce((m, line) => Math.max(m, displayWidth(line)), 0);
      return Math.max(max, longestLine);
    }, 0);

    return { wch: Math.min(Math.max(headerWidth, maxValueWidth) + 2, 60) };
  });
}

function createDateRange(startDate, endDate) {
  const result = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    result.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`
    );
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function getDayIndex(dateString) {
  return new Date(`${dateString}T00:00:00`).getDay();
}

function getDayType(dateString) {
  const day = getDayIndex(dateString);
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

function getDayTextColor(dateString) {
  const dayType = getDayType(dateString);
  if (dayType === "sunday") return "#f87171";
  if (dayType === "saturday") return "#60a5fa";
  return "#94a3b8";
}

function formatAxisDateLabel(dateString) {
  const [, month, day] = dateString.split("-");
  return `${month}.${day}`;
}

function getKoreanWeekday(dateString) {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return weekdays[getDayIndex(dateString)];
}

function formatTooltipDate(dateString) {
  return `${dateString} (${getKoreanWeekday(dateString)})`;
}

// 14자리 datetime("YYYYMMDDHHMMSS") → "HH:MM". DB는 raw 그대로 보관, 표시만 변환.
// 잘못된 값/짧은 값은 null 반환 → 호출부에서 "--" placeholder로 처리.
function formatTime14ToHHMM(s) {
  if (typeof s !== "string" || s.length < 12) return null;
  return `${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

// 14자리 datetime → "YYYY-MM-DD HH:MM" (일간 보기의 마감 요청시간에 날짜+시간 함께 표시).
function formatDateTime14ToYMDHM(s) {
  if (typeof s !== "string" || s.length < 12) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

function formatMetricValue(value, suffix = "", decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

function createDailyBucket(date) {
  return {
    date,
    plannedSessions: 0,
    actualSessions: 0,
    treatmentSum: 0,
    waitSum: 0,
    firstVisitPatients: 0,
    bookingSum: 0,
    count: 0,
  };
}

function getDiffDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function getWeekMonday(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDateToYmd(date);
}

function formatDateToYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createWeekRange(startDate, endDate) {
  const result = [];
  const current = new Date(`${getWeekMonday(startDate)}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    const weekStart = formatDateToYmd(new Date(current));
    const weekEndDate = new Date(current);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = formatDateToYmd(weekEndDate);
    const displayEnd = weekEnd > endDate ? endDate : weekEnd;

    result.push({
      weekStart,
      weekEnd: displayEnd,
      label: formatWeekLabel(weekStart, displayEnd),
    });

    current.setDate(current.getDate() + 7);
  }

  return result;
}

function formatWeekLabel(weekStart, weekEnd) {
  const startMonth = weekStart.slice(5, 7);
  const startDay = weekStart.slice(8, 10);
  const endMonth = weekEnd.slice(5, 7);
  const endDay = weekEnd.slice(8, 10);

  if (startMonth === endMonth) {
    return `${startMonth}.${startDay}~${endDay}`;
  }

  return `${startMonth}.${startDay}~${endMonth}.${endDay}`;
}

function getTrendGranularity(periodType, startDate, endDate) {
  const diffDays = getDiffDaysInclusive(startDate, endDate);

  if (periodType === "monthly") {
    if (diffDays <= 14) return "daily";
    return "daily-weekly-tick";
  }

  if (periodType === "custom") {
    if (diffDays > 31) return "weekly";
    if (diffDays <= 14) return "daily";
    return "daily-weekly-tick";
  }

  return "daily";
}

function buildTrendSeries({ records, viewType, dept, professor, startDate, endDate }) {
  const dates = createDateRange(startDate, endDate);
  const bucketMap = new Map(dates.map((date) => [date, createDailyBucket(date)]));

  records.forEach((record) => {
    if (!record.date || record.date < startDate || record.date > endDate) return;

    const isMatched =
      viewType === "hospital"
        ? true
        : viewType === "department"
        ? record.dept === dept
        : record.dept === dept && record.professor === professor;

    if (!isMatched) return;

    const bucket = bucketMap.get(record.date);
    if (!bucket) return;

    bucket.plannedSessions += Number(record.plannedSessions ?? 0);
    bucket.actualSessions += Number(record.actualSessions ?? 0);
    bucket.treatmentSum += Number(record.avgTreatmentMin ?? 0);
    bucket.waitSum += Number(record.avgWaitMin ?? 0);
    bucket.firstVisitPatients += Number(record.firstVisitPatients ?? 0);
    bucket.bookingSum += Number(record.bookingRate ?? 0);
    bucket.count += 1;
  });

  return dates.map((date) => {
    const bucket = bucketMap.get(date) || createDailyBucket(date);
    const hasData = bucket.count > 0;

    return {
      date,
      dateLabel: formatAxisDateLabel(date),
      dayType: getDayType(date),
      actualSessions: hasData ? bucket.actualSessions : 0,
      sessionUtilization:
        hasData && bucket.plannedSessions
          ? Number(((bucket.actualSessions / bucket.plannedSessions) * 100).toFixed(1))
          : 0,
      avgTreatmentMin: hasData ? Number((bucket.treatmentSum / bucket.count).toFixed(1)) : 0,
      avgWaitMin: hasData ? Number((bucket.waitSum / bucket.count).toFixed(1)) : 0,
      firstVisitPatients: hasData ? bucket.firstVisitPatients : 0,
      bookingRate: hasData ? Number((bucket.bookingSum / bucket.count).toFixed(1)) : 0,
    };
  });
}

function buildWeeklyTrendSeries({ records, viewType, dept, professor, startDate, endDate }) {
  const weeks = createWeekRange(startDate, endDate);

  const bucketMap = new Map(
    weeks.map(({ weekStart, weekEnd, label }) => [
      weekStart,
      { weekStart, weekEnd, label, ...createDailyBucket(weekStart) },
    ])
  );

  records.forEach((record) => {
    if (!record.date || record.date < startDate || record.date > endDate) return;

    const isMatched =
      viewType === "hospital"
        ? true
        : viewType === "department"
        ? record.dept === dept
        : record.dept === dept && record.professor === professor;

    if (!isMatched) return;

    const monday = getWeekMonday(record.date);
    const bucket = bucketMap.get(monday);
    if (!bucket) return;

    bucket.plannedSessions += Number(record.plannedSessions ?? 0);
    bucket.actualSessions += Number(record.actualSessions ?? 0);
    bucket.treatmentSum += Number(record.avgTreatmentMin ?? 0);
    bucket.waitSum += Number(record.avgWaitMin ?? 0);
    bucket.firstVisitPatients += Number(record.firstVisitPatients ?? 0);
    bucket.bookingSum += Number(record.bookingRate ?? 0);
    bucket.count += 1;
  });

  return weeks.map(({ weekStart, label }) => {
    const bucket = bucketMap.get(weekStart);
    const hasData = bucket.count > 0;

    return {
      date: weekStart,
      dateLabel: label,
      weekLabel: label,
      isWeekly: true,
      actualSessions: hasData ? bucket.actualSessions : 0,
      sessionUtilization:
        hasData && bucket.plannedSessions
          ? Number(((bucket.actualSessions / bucket.plannedSessions) * 100).toFixed(1))
          : 0,
      avgTreatmentMin: hasData ? Number((bucket.treatmentSum / bucket.count).toFixed(1)) : 0,
      avgWaitMin: hasData ? Number((bucket.waitSum / bucket.count).toFixed(1)) : 0,
      firstVisitPatients: hasData ? bucket.firstVisitPatients : 0,
      bookingRate: hasData ? Number((bucket.bookingSum / bucket.count).toFixed(1)) : 0,
    };
  });
}

export default function UserDashboardPage() {
  const navigate = useNavigate();

  const [periodType, setPeriodType] = useState("daily");
  const [activeView, setActiveView] = useState("department");
  const [dailyDate, setDailyDate] = useState(() => getTodayKstString());
  const [customStart, setCustomStart] = useState(() => getStartOfWeekKstString());
  const [customEnd, setCustomEnd] = useState(() => getTodayKstString());
  const [selectedDept, setSelectedDept] = useState("전체");
  const [departmentKeyword, setDepartmentKeyword] = useState("");
  const [professorKeyword, setProfessorKeyword] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "dept", direction: "asc" });
  const [trendModalTarget, setTrendModalTarget] = useState(null);
  const [hospitalTrendOpen, setHospitalTrendOpen] = useState(false);
  const [closeCountModalTarget, setCloseCountModalTarget] = useState(null);
  const [sourceHelpOpen, setSourceHelpOpen] = useState(false);
  const sourceHelpRef = useRef(null);
  const [scheduleHelpOpen, setScheduleHelpOpen] = useState(false);
  const scheduleHelpRef = useRef(null);

  const [allRecords, setAllRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCollectedAt, setLastCollectedAt] = useState(null);

  const periodRange = useMemo(
    () => getPeriodRange(periodType, customStart, customEnd, dailyDate),
    [periodType, customStart, customEnd, dailyDate]
  );

  useEffect(() => {
    const { startDate, endDate } = periodRange;
    setIsLoading(true);

    fetchDashboardRecords(startDate, endDate)
      .then(({ records, lastCollectedAt }) => {
        setAllRecords(records);
        setLastCollectedAt(lastCollectedAt);
      })
      .catch((err) => console.error("대시보드 데이터 조회 실패:", err))
      .finally(() => setIsLoading(false));
  }, [periodRange]);

  // 기간 필터는 API에서 이미 적용되므로 별도 클라이언트 필터링 없이 그대로 사용한다.
  const recordsByPeriod = allRecords;

  const isTrendViewAvailable = periodType !== "daily";

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const availableDepartments = useMemo(() => {
    const deptSet = new Set(recordsByPeriod.map((item) => item.dept));
    return ["전체", ...Array.from(deptSet)];
  }, [recordsByPeriod]);

  const baseFilteredRecords = useMemo(() => {
    if (selectedDept === "전체") return recordsByPeriod;
    return recordsByPeriod.filter((item) => item.dept === selectedDept);
  }, [recordsByPeriod, selectedDept]);

  const departmentRows = useMemo(() => {
    const grouped = baseFilteredRecords.reduce((acc, cur) => {
      if (!acc[cur.dept]) {
        acc[cur.dept] = createAggregateBucket(cur.dept);
      }

      const bucket = acc[cur.dept];

      bucket.professorSet.add(cur.professor);
      bucket.plannedSessions += cur.plannedSessions;
      bucket.actualSessions += cur.actualSessions;
      bucket.treatmentSum += cur.avgTreatmentMin;
      bucket.waitSum += cur.avgWaitMin;
      bucket.firstVisitPatients += cur.firstVisitPatients;
      bucket.revisitPatients += cur.revisitPatients;
      bucket.bookingSum += cur.bookingRate;
      bucket.count += 1;

      return acc;
    }, {});

    return Object.values(grouped).map((item) => {
      const professorCount = item.professorSet.size;
      const avgTreatmentMin = item.count ? item.treatmentSum / item.count : 0;
      const avgWaitMin = item.count ? item.waitSum / item.count : 0;
      const bookingRate = item.count ? item.bookingSum / item.count : 0;
      const sessionUtilization = item.plannedSessions
        ? (item.actualSessions / item.plannedSessions) * 100
        : 0;

      return {
        dept: item.labelValue,
        secondColumn: professorCount,
        plannedSessions: item.plannedSessions,
        actualSessions: item.actualSessions,
        sessionUtilization,
        avgTreatmentMin,
        avgWaitMin,
        firstVisitPatients: item.firstVisitPatients,
        revisitPatients: item.revisitPatients,
        bookingRate,
      };
    });
  }, [baseFilteredRecords]);

  const filteredDepartmentRows = useMemo(() => {
    const keyword = departmentKeyword.trim().toLowerCase();
    if (!keyword) return departmentRows;
    return departmentRows.filter((row) =>
      String(row.dept).toLowerCase().includes(keyword)
    );
  }, [departmentRows, departmentKeyword]);

  const professorRows = useMemo(() => {
    const grouped = baseFilteredRecords.reduce((acc, cur) => {
      const groupKey = `${cur.dept}__${cur.professor}`;

      if (!acc[groupKey]) {
        acc[groupKey] = createAggregateBucket(cur.professor);
        acc[groupKey].dept = cur.dept;
        // 일간용 단일값 + 기간용 마감 리스트 누적 (createAggregateBucket은 공용이라 여기서 확장)
        acc[groupKey].treatmentStartTime = null;
        acc[groupKey].treatmentEndTime   = null;
        acc[groupKey].closeRequestTime   = null;
        acc[groupKey].closeReason        = null;
        acc[groupKey].closeRequests      = [];
      }

      const bucket = acc[groupKey];

      bucket.plannedSessions    += cur.plannedSessions;
      bucket.actualSessions     += cur.actualSessions;
      bucket.treatmentSum       += cur.avgTreatmentMin;
      bucket.waitSum            += cur.avgWaitMin;
      bucket.firstVisitPatients += cur.firstVisitPatients;
      bucket.revisitPatients    += cur.revisitPatients;
      bucket.bookingSum         += cur.bookingRate;
      bucket.count              += 1;

      // 일간 보기는 (의사,과)당 cur 1개라 그 값이 그대로 들어감.
      // 기간 보기에선 마지막 row 값으로 덮어쓰이지만 기간 화면엔 표시되지 않으므로 무관.
      if (cur.treatmentStartTime) bucket.treatmentStartTime = cur.treatmentStartTime;
      if (cur.treatmentEndTime)   bucket.treatmentEndTime   = cur.treatmentEndTime;
      if (cur.closeRequestTime)   bucket.closeRequestTime   = cur.closeRequestTime;
      if (cur.closeReason)        bucket.closeReason        = cur.closeReason;

      // 마감 요청이 있는 날만 리스트에 누적. 기간 보기의 closeCount / 모달 closeRequests[].
      if (cur.closeRequestTime) {
        bucket.closeRequests.push({
          date:        cur.date,
          requestTime: cur.closeRequestTime,
          reason:      cur.closeReason,
        });
      }

      return acc;
    }, {});

    const rows = Object.values(grouped).map((item) => {
      const sessionUtilization = item.plannedSessions
        ? (item.actualSessions / item.plannedSessions) * 100
        : 0;

      return {
        dept: item.dept,
        secondColumn: item.labelValue,
        plannedSessions: item.plannedSessions,
        actualSessions: item.actualSessions,
        sessionUtilization,
        avgTreatmentMin: item.count ? item.treatmentSum / item.count : 0,
        avgWaitMin: item.count ? item.waitSum / item.count : 0,
        firstVisitPatients: item.firstVisitPatients,
        revisitPatients: item.revisitPatients,
        bookingRate: item.count ? item.bookingSum / item.count : 0,
        // 일간 보기에서 사용 (single value)
        treatmentStartTime: item.treatmentStartTime,
        treatmentEndTime:   item.treatmentEndTime,
        closeRequestTime:   item.closeRequestTime,
        closeReason:        item.closeReason,
        // 기간 보기에서 사용 (count + list)
        closeRequests:      item.closeRequests,
        closeCount:         item.closeRequests.length,
      };
    });

    return rows.filter((row) =>
      String(row.secondColumn).toLowerCase().includes(professorKeyword.toLowerCase())
    );
  }, [baseFilteredRecords, professorKeyword]);

  const sortedDepartmentRows = useMemo(() => {
    return sortRows(filteredDepartmentRows, sortConfig);
  }, [filteredDepartmentRows, sortConfig]);

  const sortedProfessorRows = useMemo(() => {
    return sortRows(professorRows, sortConfig);
  }, [professorRows, sortConfig]);

  const currentRows = activeView === "department" ? sortedDepartmentRows : sortedProfessorRows;

  const summary = useMemo(() => {
    const source = currentRows;

    const plannedSessions = source.reduce((sum, item) => sum + item.plannedSessions, 0);
    const actualSessions = source.reduce((sum, item) => sum + item.actualSessions, 0);
    const avgTreatmentMin =
      source.length > 0
        ? source.reduce((sum, item) => sum + item.avgTreatmentMin, 0) / source.length
        : 0;
    const avgWaitMin =
      source.length > 0
        ? source.reduce((sum, item) => sum + item.avgWaitMin, 0) / source.length
        : 0;
    const firstVisitPatients = source.reduce((sum, item) => sum + item.firstVisitPatients, 0);
    const revisitPatients = source.reduce((sum, item) => sum + item.revisitPatients, 0);

    return { plannedSessions, actualSessions, avgTreatmentMin, avgWaitMin, firstVisitPatients, revisitPatients };
  }, [currentRows]);

  const hospitalSummary = useMemo(() => {
    const source = recordsByPeriod;

    const plannedSessions = source.reduce((sum, item) => sum + Number(item.plannedSessions ?? 0), 0);
    const actualSessions = source.reduce((sum, item) => sum + Number(item.actualSessions ?? 0), 0);
    const avgTreatmentMin =
      source.length > 0
        ? source.reduce((sum, item) => sum + Number(item.avgTreatmentMin ?? 0), 0) / source.length
        : 0;
    const avgWaitMin =
      source.length > 0
        ? source.reduce((sum, item) => sum + Number(item.avgWaitMin ?? 0), 0) / source.length
        : 0;
    const firstVisitPatients = source.reduce((sum, item) => sum + Number(item.firstVisitPatients ?? 0), 0);
    const bookingRate =
      source.length > 0
        ? source.reduce((sum, item) => sum + Number(item.bookingRate ?? 0), 0) / source.length
        : 0;

    return {
      actualSessions,
      sessionUtilization: plannedSessions ? (actualSessions / plannedSessions) * 100 : 0,
      avgTreatmentMin,
      avgWaitMin,
      firstVisitPatients,
      bookingRate,
    };
  }, [recordsByPeriod]);

  const trendGranularity = useMemo(
    () => getTrendGranularity(periodType, periodRange.startDate, periodRange.endDate),
    [periodType, periodRange]
  );

  const trendSeries = useMemo(() => {
    if (!trendModalTarget) return [];

    const args = {
      records: recordsByPeriod,
      viewType: trendModalTarget.viewType,
      dept: trendModalTarget.dept,
      professor: trendModalTarget.professor,
      startDate: periodRange.startDate,
      endDate: periodRange.endDate,
    };

    return trendGranularity === "weekly"
      ? buildWeeklyTrendSeries(args)
      : buildTrendSeries(args);
  }, [trendModalTarget, recordsByPeriod, periodRange, trendGranularity]);

  const hospitalTrendSeries = useMemo(() => {
    const args = {
      records: recordsByPeriod,
      viewType: "hospital",
      startDate: periodRange.startDate,
      endDate: periodRange.endDate,
    };

    return trendGranularity === "weekly"
      ? buildWeeklyTrendSeries(args)
      : buildTrendSeries(args);
  }, [recordsByPeriod, periodRange, trendGranularity]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const resetFilters = () => {
    setSelectedDept("전체");
    setDepartmentKeyword("");
    setProfessorKeyword("");
    setSortConfig({
      key: activeView === "department" ? "dept" : "secondColumn",
      direction: "asc",
    });
  };

  const handleExcelDownload = () => {
    if (currentRows.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const { startDate, endDate } = periodRange;
    const secondHeaderLabel = activeView === "department" ? "교수 수" : "교수명";

    // 화면 표와 동일한 컬럼 구성으로 내보냄.
    const isDailyProfessor = activeView === "professor" && periodType === "daily";
    const isRangeProfessor = activeView === "professor" && periodType !== "daily";
    const dash = (v) => (v === undefined || v === null || v === "" ? "--" : v);

    const exportRows = currentRows.map((row) => {
      if (isDailyProfessor) {
        return {
          진료과: row.dept,
          [secondHeaderLabel]: row.secondColumn,
          "실 세션": row.actualSessions,
          "진료 시작시간": dash(formatTime14ToHHMM(row.treatmentStartTime)),
          "진료 종료시간": dash(formatTime14ToHHMM(row.treatmentEndTime)),
          "평균 진료시간": `${row.avgTreatmentMin.toFixed(1)}분`,
          "평균 대기시간": `${row.avgWaitMin.toFixed(1)}분`,
          "마감 요청시간": dash(formatTime14ToHHMM(row.closeRequestTime)),
          "마감 사유": dash(row.closeReason),
          "초진(병초)": row.firstVisitPatients,
          재진: row.revisitPatients,
          "예약현황 가동률": `${Math.round(row.bookingRate)}%`,
        };
      }
      if (isRangeProfessor) {
        // 일자 오름차순(오래된 것이 위, 최신이 아래) 정렬 후 두 컬럼을 각각 \n로 합침.
        // 두 셀의 N번째 줄이 서로 짝(같은 마감 1건)이 되도록 같은 순서로 만든다.
        const requests = (row.closeRequests ?? [])
          .slice()
          .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));

        // 일자 / 마감 요청시간 / 마감 사유 — 모달과 동일하게 3컬럼 분리.
        // N번째 줄이 모두 같은 마감 1건의 정보가 되도록 같은 순서로 매핑.
        const dates = requests.length === 0
          ? "--"
          : requests.map((r) => r.date ?? "--").join("\n");

        const requestTimes = requests.length === 0
          ? "--"
          : requests.map((r) => formatDateTime14ToYMDHM(r.requestTime) ?? "--").join("\n");

        const reasons = requests.length === 0
          ? "--"
          : requests.map((r) => r.reason ?? "--").join("\n");

        return {
          진료과: row.dept,
          [secondHeaderLabel]: row.secondColumn,
          "계획 세션": row.plannedSessions,
          "실 세션": row.actualSessions,
          "세션 가동률": `${Math.round(row.sessionUtilization)}%`,
          "평균 진료시간": `${row.avgTreatmentMin.toFixed(1)}분`,
          "평균 대기시간": `${row.avgWaitMin.toFixed(1)}분`,
          "마감 건수": dash(row.closeCount),
          "일자": dates,
          "마감 요청시간": requestTimes,
          "마감 사유": reasons,
          "초진(병초)": row.firstVisitPatients,
          재진: row.revisitPatients,
          "예약현황 가동률": `${Math.round(row.bookingRate)}%`,
        };
      }
      return {
        진료과: row.dept,
        [secondHeaderLabel]: row.secondColumn,
        "계획 세션": row.plannedSessions,
        "실 세션": row.actualSessions,
        "세션 가동률": `${Math.round(row.sessionUtilization)}%`,
        "평균 진료시간": `${row.avgTreatmentMin.toFixed(1)}분`,
        "평균 대기시간": `${row.avgWaitMin.toFixed(1)}분`,
        "초진(병초)": row.firstVisitPatients,
        재진: row.revisitPatients,
        "예약현황 가동률": `${Math.round(row.bookingRate)}%`,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = getColumnWidthsFromRows(exportRows);

    if (worksheet["!ref"]) {
      worksheet["!autofilter"] = { ref: worksheet["!ref"] };
    }

    // 마감 요청시간 / 마감 사유 셀: 줄바꿈 표시(wrapText) + 줄 수에 맞춰 행 높이 자동 조정.
    // 행 높이가 늘어나면 다른 셀(진료과/교수명 등)도 vertical:top 으로 정렬해야 하단에 붙지 않음.
    if (isRangeProfessor && exportRows.length > 0) {
      const headerKeys = Object.keys(exportRows[0]);
      const multiLineCols = ["일자", "마감 요청시간", "마감 사유"];
      const multiLineIndices = multiLineCols
        .map((name) => headerKeys.indexOf(name))
        .filter((i) => i >= 0);

      const rowHeights = [{ hpx: 22 }]; // 헤더 행

      exportRows.forEach((row, i) => {
        // 한 행의 모든 셀에 vertical:top 적용. 마감 관련 셀에만 wrapText 추가.
        headerKeys.forEach((_, colIdx) => {
          const cellAddr = XLSX.utils.encode_cell({ r: i + 1, c: colIdx });
          if (worksheet[cellAddr]) {
            const isMultiLine = multiLineIndices.includes(colIdx);
            worksheet[cellAddr].s = {
              alignment: { vertical: "top", wrapText: isMultiLine },
            };
          }
        });
        // 행 높이는 두 마감 컬럼 중 더 많은 줄 수 기준 (보통 둘이 같음)
        const lineCount = multiLineCols.reduce((max, col) => {
          return Math.max(max, String(row[col] ?? "").split("\n").length);
        }, 1);
        rowHeights.push({ hpx: Math.max(20, lineCount * 16) });
      });
      worksheet["!rows"] = rowHeights;
    }

    const workbook = XLSX.utils.book_new();
    const sheetName = buildSheetName(activeView, periodType, startDate, endDate);
    const fileName = buildFileName(activeView, periodType, startDate, endDate);

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
  };

  const handleOpenTrendModal = (row) => {
    if (!isTrendViewAvailable) return;

    setTrendModalTarget({
      viewType: activeView,
      dept: row.dept,
      professor: activeView === "professor" ? row.secondColumn : null,
      label: activeView === "department" ? row.dept : `${row.secondColumn} 교수`,
      summaryRow: row,
    });
  };

  const handleOpenHospitalTrendModal = () => {
    if (!isTrendViewAvailable) return;
    setHospitalTrendOpen(true);
  };

  const legendTitle =
    activeView === "department"
      ? "세션 가동률 및 예약현황 가동률 기준"
      : "예약현황 가동률 기준";

  const secondHeaderLabel = activeView === "department" ? "교수 수" : "교수명";

  const sourceGuideItems = useMemo(() => {
    if (activeView === "department") {
      return [
        { label: "진료과 / 교수 수 / 계획 세션 / 실 세션 / 세션 가동률", source: "외래진료의사별 session 개설현황" },
        { label: "평균 진료시간 / 평균 대기시간", source: "외래대기환자전광판관리" },
        { label: "초진(병초) / 재진", source: "진료과별 의사별 환자실적" },
        { label: "예약현황 가동률", source: "외래진료예약" },
      ];
    }

    // 교수별 + 일간 — 계획 세션·세션 가동률 빠지고 진료 시작/종료시간·마감 요청시간·마감 사유가 추가됨
    if (periodType === "daily") {
      return [
        { label: "진료과 / 교수 명 / 실 세션", source: "외래진료의사별 session 개설현황" },
        { label: "진료 시작시간 / 진료 종료시간 / 평균 진료시간 / 평균 대기시간", source: "외래대기환자전광판관리" },
        { label: "마감 요청시간 / 마감 사유", source: "의사별당일마감조회" },
        { label: "초진(병초) / 재진", source: "진료과별 의사별 환자실적" },
        { label: "예약현황 가동률", source: "외래진료예약" },
      ];
    }

    // 교수별 + 주간/월간/기간 선택 — 마감 건수 추가
    return [
      { label: "진료과 / 교수 명 / 계획 세션 / 실 세션 / 세션 가동률", source: "외래진료의사별 session 개설현황" },
      { label: "평균 진료시간 / 평균 대기시간", source: "외래대기환자전광판관리" },
      { label: "마감 건수", source: "의사별당일마감조회" },
      { label: "초진(병초) / 재진", source: "진료과별 의사별 환자실적" },
      { label: "예약현황 가동률", source: "외래진료예약" },
    ];
  }, [activeView, periodType]);

  // 마감 건수 컬럼이 보이는 조합: 교수별 + (주간/월간/기간선택)
  const isRangeProfessorView = activeView === "professor" && periodType !== "daily";

  const handleOpenCloseCountModal = (row) => {
    setCloseCountModalTarget({
      dept: row.dept,
      professor: row.secondColumn,
      closeRequests: row.closeRequests ?? [], // 데이터 연결 전이라 빈 배열 가능
    });
  };

  const isAnyModalOpen = Boolean(trendModalTarget || hospitalTrendOpen || closeCountModalTarget);

  useEffect(() => {
    if (periodType === "daily") {
      setTrendModalTarget(null);
      setHospitalTrendOpen(false);
      setCloseCountModalTarget(null);
    }
  }, [periodType]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!sourceHelpRef.current?.contains(event.target)) {
        setSourceHelpOpen(false);
      }
      if (!scheduleHelpRef.current?.contains(event.target)) {
        setScheduleHelpOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSourceHelpOpen(false);
        setScheduleHelpOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isAnyModalOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setTrendModalTarget(null);
        setHospitalTrendOpen(false);
        setCloseCountModalTarget(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAnyModalOpen]);

  return (
    <div className="h-screen overflow-hidden bg-[#030712] text-white">
      <div className="relative h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_25%),linear-gradient(135deg,#030712_0%,#07111f_44%,#030712_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(96,165,250,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.2)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="pointer-events-none absolute left-[12%] top-[8%] h-[320px] w-[320px] rounded-full bg-sky-500/[0.08] blur-[120px] animate-pulse" />
        <div className="pointer-events-none absolute right-[10%] top-[22%] h-[260px] w-[260px] rounded-full bg-blue-600/[0.08] blur-[120px] animate-pulse" />

        <div className="relative z-10 mx-auto flex h-full max-w-[1460px] flex-col px-5 py-5 lg:px-8 lg:py-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-400/15 bg-sky-400/8 px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] text-sky-300/80 uppercase">
                <Sparkles size={12} />
                Outpatient Dashboard
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-white lg:text-[34px]">
                  외래 진료 운영 대시보드
                </h1>
                {isTrendViewAvailable && (
                  <button
                    type="button"
                    onClick={handleOpenHospitalTrendModal}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em] text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.18)] transition hover:border-sky-300/50 hover:bg-sky-400/15 hover:text-sky-100 hover:shadow-[0_0_20px_rgba(56,189,248,0.35)]"
                    aria-label="병원 전체 추이 보기"
                  >
                    <TrendingUp size={13} />
                    병원 전체 추이
                  </button>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                {lastCollectedAt && (
                  <>
                    <span ref={scheduleHelpRef} className="relative inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setScheduleHelpOpen((prev) => !prev)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-sky-300/30 hover:bg-white/[0.08] hover:text-sky-200"
                        aria-label="자동 업데이트 시각 도움말"
                      >
                        <CircleHelp size={12} />
                      </button>
                      <span>
                        마지막 업데이트:{" "}
                        <span className="text-slate-400">
                          {new Date(lastCollectedAt).toLocaleString("ko-KR", {
                            timeZone: "Asia/Seoul",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                      </span>
                      {scheduleHelpOpen && <ScheduleHelpPopover />}
                    </span>
                    <span className="text-slate-600">·</span>
                  </>
                )}
                <span>{import.meta.env.VITE_DATA_AVAILABLE_FROM_LABEL || "2026년 4월 1일"}부터 데이터 조회가 가능합니다.</span>

                {periodType === "daily" && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span>조회일:</span>
                      <input
                        type="date"
                        value={dailyDate}
                        onChange={(e) => setDailyDate(e.target.value)}
                        style={{ colorScheme: "dark" }}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[13px] text-slate-200 outline-none transition focus:border-sky-400/40"
                      />
                    </span>
                  </>
                )}

                {(periodType === "weekly" || periodType === "monthly") && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span>조회기간:</span>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[13px] text-slate-200">
                        {periodRange.startDate} ~ {periodRange.endDate}
                      </span>
                    </span>
                  </>
                )}

                {periodType === "custom" && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span>조회기간:</span>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        style={{ colorScheme: "dark" }}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[13px] text-slate-200 outline-none transition focus:border-sky-400/40"
                      />
                      <span className="text-slate-600">~</span>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        style={{ colorScheme: "dark" }}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[13px] text-slate-200 outline-none transition focus:border-sky-400/40"
                      />
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPeriodType(option.key)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      periodType === option.key
                        ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition duration-200 hover:border-sky-300/30 hover:bg-white/[0.07]"
              >
                <LogOut size={16} />
                로그아웃
              </button>
            </div>
          </div>

          {/* 로딩 인디케이터 */}
          {isLoading && (
            <div className="mb-2 flex items-center gap-2 text-sm text-sky-400">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
              데이터 불러오는 중...
            </div>
          )}

          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <KpiCard icon={<CalendarDays size={18} />} title="계획 세션" value={summary.plannedSessions} accent="from-blue-600 to-sky-500" delay="0ms" />
            <KpiCard icon={<Activity size={18} />} title="실 세션" value={summary.actualSessions} accent="from-indigo-600 to-blue-500" delay="70ms" />
            <KpiCard icon={<Stethoscope size={18} />} title="평균 진료시간" value={summary.avgTreatmentMin} suffix="분" decimals={1} accent="from-cyan-600 to-sky-500" delay="140ms" />
            <KpiCard icon={<Clock3 size={18} />} title="평균 대기시간" value={summary.avgWaitMin} suffix="분" decimals={1} accent="from-violet-600 to-indigo-500" delay="210ms" />
            <KpiCard icon={<Users size={18} />} title="초진 환자" value={summary.firstVisitPatients} suffix="명" accent="from-emerald-600 to-teal-500" delay="280ms" />
            <KpiCard icon={<Users size={18} />} title="재진 환자" value={summary.revisitPatients} suffix="명" accent="from-orange-500 to-amber-500" delay="350ms" />
          </div>

          <div className="relative z-[70] mb-4 overflow-visible rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.76),rgba(2,8,23,0.94))] p-4 shadow-[0_0_80px_rgba(2,132,199,0.08)] backdrop-blur-2xl">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => { setActiveView("department"); setSortConfig({ key: "dept", direction: "asc" }); }}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      activeView === "department"
                        ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    진료과별 현황
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveView("professor"); setSortConfig({ key: "secondColumn", direction: "asc" }); }}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      activeView === "professor"
                        ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    교수별 현황
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300">
                  <span className="mr-2 text-slate-500">기준:</span>
                  {getPeriodLabel(periodType, customStart, customEnd)}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300">
                  <span className="mr-2 text-slate-500">행 수:</span>
                  {currentRows.length}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <SelectField compact label="진료과" value={selectedDept} options={availableDepartments} onChange={setSelectedDept} />

                <div className="w-[240px]">
                  {activeView === "department" ? (
                    <div className="relative w-full">
                      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={departmentKeyword}
                        onChange={(e) => setDepartmentKeyword(e.target.value)}
                        placeholder="진료과 검색"
                        className="h-[48px] w-full rounded-[16px] border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500/50 focus:bg-white/[0.06]"
                      />
                    </div>
                  ) : (
                    <div className="relative w-full">
                      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={professorKeyword}
                        onChange={(e) => setProfessorKeyword(e.target.value)}
                        placeholder="교수명 검색"
                        className="h-[48px] w-full rounded-[16px] border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500/50 focus:bg-white/[0.06]"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-sky-300/30 hover:bg-white/[0.07]"
                >
                  <RefreshCcw size={15} />
                  초기화
                </button>

                <button
                  type="button"
                  onClick={handleExcelDownload}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-500/15"
                >
                  <Download size={15} />
                  엑셀 다운로드
                </button>
              </div>
            </div>
          </div>

          <div className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,8,23,0.96))] shadow-[0_0_80px_rgba(2,132,199,0.08)] backdrop-blur-2xl">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                  <span className="text-sm">데이터 불러오는 중...</span>
                </div>
              </div>
            ) : (
              <UnifiedList
                rows={currentRows}
                secondHeaderLabel={secondHeaderLabel}
                sortConfig={sortConfig}
                onSort={handleSort}
                activeView={activeView}
                periodType={periodType}
                onRowClick={isTrendViewAvailable ? handleOpenTrendModal : undefined}
                onCloseCountClick={isRangeProfessorView ? handleOpenCloseCountModal : undefined}
              />
            )}
          </div>

          <div className="mt-4 flex shrink-0 flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.025] px-5 py-4 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-5">
              <div className="font-medium text-slate-100">{legendTitle}</div>
              <Legend label="90% 이상" color="bg-emerald-500" />
              <Legend label="80~89%" color="bg-amber-400" />
              <Legend label="80% 미만" color="bg-orange-500" />
            </div>

            <div ref={sourceHelpRef} className="relative flex items-center justify-end">
              <div className="flex items-center gap-2 text-slate-400">
                <span>데이터 출처 : 카우누리</span>
                <button
                  type="button"
                  onClick={() => setSourceHelpOpen((prev) => !prev)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-sky-300/30 hover:bg-white/[0.08] hover:text-sky-200"
                  aria-label="데이터 출처 도움말"
                >
                  <CircleHelp size={14} />
                </button>
              </div>

              {sourceHelpOpen && (
                <SourceHelpPopover activeView={activeView} items={sourceGuideItems} />
              )}
            </div>
          </div>
        </div>

        {trendModalTarget && (
          <TrendModal
            target={trendModalTarget}
            trendSeries={trendSeries}
            onClose={() => setTrendModalTarget(null)}
            periodType={periodType}
            startDate={periodRange.startDate}
            endDate={periodRange.endDate}
            granularity={trendGranularity}
          />
        )}

        {hospitalTrendOpen && (
          <TrendModal
            target={{ viewType: "hospital", label: "병원 전체", summaryRow: hospitalSummary }}
            trendSeries={hospitalTrendSeries}
            onClose={() => setHospitalTrendOpen(false)}
            periodType={periodType}
            startDate={periodRange.startDate}
            endDate={periodRange.endDate}
            granularity={trendGranularity}
          />
        )}

        {closeCountModalTarget && (
          <CloseCountModal
            target={closeCountModalTarget}
            periodRange={periodRange}
            onClose={() => setCloseCountModalTarget(null)}
          />
        )}

        <style>{`
          .dashboard-scroll {
            scrollbar-gutter: stable;
            scrollbar-width: thin;
            scrollbar-color: rgba(125, 211, 252, 0.35) transparent;
          }
          .dashboard-scroll::-webkit-scrollbar { width: 8px; }
          .dashboard-scroll::-webkit-scrollbar-track { background: transparent; }
          .dashboard-scroll::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(56,189,248,0.38), rgba(14,165,233,0.26));
            border-radius: 999px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }
          .dashboard-scroll::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, rgba(56,189,248,0.55), rgba(14,165,233,0.38));
            background-clip: padding-box;
          }
          .custom-select-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(125, 211, 252, 0.35) transparent;
          }
          .custom-select-scroll::-webkit-scrollbar { width: 8px; }
          .custom-select-scroll::-webkit-scrollbar-track { background: transparent; }
          .custom-select-scroll::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(56,189,248,0.35), rgba(14,165,233,0.22));
            border-radius: 999px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }
          .custom-select-scroll::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, rgba(56,189,248,0.55), rgba(14,165,233,0.34));
            background-clip: padding-box;
          }
          @keyframes dropdownFade {
            0% { opacity: 0; transform: translateY(-6px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes tableFade {
            0% { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes barShine {
            0% { transform: translateX(-140%); }
            100% { transform: translateX(180%); }
          }
          @keyframes modalPop {
            0% { opacity: 0; transform: translateY(14px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}

function UnifiedList({ rows, secondHeaderLabel, sortConfig, onSort, activeView, periodType, onRowClick, onCloseCountClick }) {
  // 보기·기간 조합별 컬럼 변형:
  //   - 교수별 + 일간              → 12컬럼 (계획세션·세션가동률 제거, 진료시작·종료·마감요청·마감사유 추가)
  //   - 교수별 + 주간/월간/기간선택 → 11컬럼 (기존 + 마감 건수)
  //   - 진료과별 전체              → 기본 10컬럼
  const isDailyProfessor = activeView === "professor" && periodType === "daily";
  const isRangeProfessor = activeView === "professor" && periodType !== "daily";

  let columns;
  let gridClass;

  if (isDailyProfessor) {
    columns = [
      { key: "dept", label: "진료과" },
      { key: "secondColumn", label: secondHeaderLabel },
      { key: "actualSessions", label: "실 세션" },
      { key: "treatmentStartTime", label: "진료 시작시간" },
      { key: "treatmentEndTime", label: "진료 종료시간" },
      { key: "avgTreatmentMin", label: "평균 진료시간" },
      { key: "avgWaitMin", label: "평균 대기시간" },
      { key: "closeRequestTime", label: "마감 요청시간" },
      { key: "closeReason", label: "마감 사유" },
      { key: "firstVisitPatients", label: "초진(병초)" },
      { key: "revisitPatients", label: "재진" },
      { key: "bookingRate", label: "예약현황 가동률" },
    ];
    gridClass = DAILY_PROFESSOR_GRID;
  } else if (isRangeProfessor) {
    columns = [
      { key: "dept", label: "진료과" },
      { key: "secondColumn", label: secondHeaderLabel },
      { key: "plannedSessions", label: "계획 세션" },
      { key: "actualSessions", label: "실 세션" },
      { key: "sessionUtilization", label: "세션 가동률" },
      { key: "avgTreatmentMin", label: "평균 진료시간" },
      { key: "avgWaitMin", label: "평균 대기시간" },
      { key: "closeCount", label: "마감 건수" },
      { key: "firstVisitPatients", label: "초진(병초)" },
      { key: "revisitPatients", label: "재진" },
      { key: "bookingRate", label: "예약현황 가동률" },
    ];
    gridClass = RANGE_PROFESSOR_GRID;
  } else {
    columns = [
      { key: "dept", label: "진료과" },
      { key: "secondColumn", label: secondHeaderLabel },
      { key: "plannedSessions", label: "계획 세션" },
      { key: "actualSessions", label: "실 세션" },
      { key: "sessionUtilization", label: "세션 가동률" },
      { key: "avgTreatmentMin", label: "평균 진료시간" },
      { key: "avgWaitMin", label: "평균 대기시간" },
      { key: "firstVisitPatients", label: "초진(병초)" },
      { key: "revisitPatients", label: "재진" },
      { key: "bookingRate", label: "예약현황 가동률" },
    ];
    gridClass = COMMON_GRID;
  }
  const isClickable = typeof onRowClick === "function";
  // 데이터 소스 연결 전이라 placeholder 표기.
  const placeholder = (value) => (value === undefined || value === null || value === "" ? "--" : value);

  return (
    <div
      key={`${activeView}-${periodType}-${sortConfig.key}-${sortConfig.direction}-${rows.length}`}
      className="dashboard-scroll h-full min-h-0 overflow-y-scroll animate-[tableFade_0.32s_ease]"
    >
      <div className={`sticky top-0 z-10 grid ${gridClass} border-b border-white/10 bg-[rgba(11,18,32,0.94)] px-3 py-3.5 text-[14px] font-semibold tracking-[0.02em] text-slate-200 backdrop-blur-xl lg:text-[15px]`}>
        {columns.map((column) => (
          <SortHeader key={column.key} label={column.label} sortKey={column.key} sortConfig={sortConfig} onSort={onSort} />
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState text="조건에 맞는 데이터가 없습니다." />
      ) : (
        rows.map((row, index) => (
          <div
            key={`row-${index}`}
            onClick={() => isClickable && onRowClick(row)}
            className={`grid ${gridClass} items-center border-b border-white/8 px-3 py-4 text-[16px] text-slate-100 transition duration-200 ${
              isClickable ? "cursor-pointer hover:bg-white/[0.04]" : "cursor-default hover:bg-white/[0.03]"
            }`}
          >
            {isDailyProfessor ? (
              <>
                <Cell className="text-[17px] font-semibold text-white">{row.dept}</Cell>
                <Cell className="tabular-nums text-[16px] font-medium text-slate-100">{row.secondColumn}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.actualSessions}</Cell>
                <Cell className="tabular-nums text-[16px] text-slate-400">{placeholder(formatTime14ToHHMM(row.treatmentStartTime))}</Cell>
                <Cell className="tabular-nums text-[16px] text-slate-400">{placeholder(formatTime14ToHHMM(row.treatmentEndTime))}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.avgTreatmentMin.toFixed(1)}분</Cell>
                <Cell className="tabular-nums text-[16px]">{row.avgWaitMin.toFixed(1)}분</Cell>
                <Cell className="tabular-nums text-[16px] text-slate-400">{placeholder(formatDateTime14ToYMDHM(row.closeRequestTime))}</Cell>
                <Cell className="text-[16px] text-slate-400">{placeholder(row.closeReason)}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.firstVisitPatients}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.revisitPatients}</Cell>
                <Cell><MetricBar value={row.bookingRate} booking /></Cell>
              </>
            ) : isRangeProfessor ? (
              <>
                <Cell className="text-[17px] font-semibold text-white">{row.dept}</Cell>
                <Cell className="tabular-nums text-[16px] font-medium text-slate-100">{row.secondColumn}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.plannedSessions}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.actualSessions}</Cell>
                <Cell><MetricBar value={row.sessionUtilization} /></Cell>
                <Cell className="tabular-nums text-[16px]">{row.avgTreatmentMin.toFixed(1)}분</Cell>
                <Cell className="tabular-nums text-[16px]">{row.avgWaitMin.toFixed(1)}분</Cell>
                <Cell
                  className="tabular-nums text-[16px] text-sky-300 cursor-pointer underline-offset-4 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseCountClick?.(row);
                  }}
                >
                  {placeholder(row.closeCount)}
                </Cell>
                <Cell className="tabular-nums text-[16px]">{row.firstVisitPatients}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.revisitPatients}</Cell>
                <Cell><MetricBar value={row.bookingRate} booking /></Cell>
              </>
            ) : (
              <>
                <Cell className="text-[17px] font-semibold text-white">{row.dept}</Cell>
                <Cell className="tabular-nums text-[16px] font-medium text-slate-100">{row.secondColumn}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.plannedSessions}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.actualSessions}</Cell>
                <Cell><MetricBar value={row.sessionUtilization} /></Cell>
                <Cell className="tabular-nums text-[16px]">{row.avgTreatmentMin.toFixed(1)}분</Cell>
                <Cell className="tabular-nums text-[16px]">{row.avgWaitMin.toFixed(1)}분</Cell>
                <Cell className="tabular-nums text-[16px]">{row.firstVisitPatients}</Cell>
                <Cell className="tabular-nums text-[16px]">{row.revisitPatients}</Cell>
                <Cell><MetricBar value={row.bookingRate} booking /></Cell>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function CloseCountModal({ target, periodRange, onClose }) {
  const [keyword, setKeyword] = useState("");

  // 최신순(일자 내림차순) + 검색어 필터
  const filteredRows = useMemo(() => {
    const all = (target.closeRequests ?? [])
      .slice()
      .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

    const lower = keyword.trim().toLowerCase();
    if (!lower) return all;

    return all.filter((r) =>
      String(r.date ?? "").toLowerCase().includes(lower) ||
      String(r.requestTime ?? "").toLowerCase().includes(lower) ||
      String(r.reason ?? "").toLowerCase().includes(lower)
    );
  }, [target.closeRequests, keyword]);

  const totalCount = (target.closeRequests ?? []).length;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[820px] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,29,0.98),rgba(3,9,20,0.98))] shadow-[0_40px_120px_rgba(2,8,23,0.65)] animate-[modalPop_0.22s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-sky-300/85 uppercase">
                Close Detail
              </div>
              <h3 className="text-[22px] font-semibold text-white">
                {target.professor} <span className="text-slate-400">({target.dept})</span> — 마감 조회 내역
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                조회기간: {periodRange.startDate} ~ {periodRange.endDate} · 총 {totalCount}건
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 검색 */}
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="검색 (날짜·시간·사유)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* 표 */}
        <div className="dashboard-scroll max-h-[60vh] overflow-y-auto">
          <div className="sticky top-0 z-10 grid grid-cols-[120px_210px_1fr] border-b border-white/10 bg-[rgba(11,18,32,0.94)] px-4 py-3 text-[13px] font-semibold tracking-[0.02em] text-slate-200 backdrop-blur-xl">
            <div className="text-center">일자</div>
            <div className="text-center">마감 요청시간</div>
            <div className="text-center">마감 사유</div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-slate-500">
              {totalCount === 0 ? "마감 조회 내역이 없습니다." : "검색 결과가 없습니다."}
            </div>
          ) : (
            filteredRows.map((row, i) => (
              <div
                key={`close-${i}`}
                className="grid grid-cols-[120px_210px_1fr] items-center border-b border-white/8 px-4 py-3 text-[14px] text-slate-100"
              >
                <div className="text-center tabular-nums">{row.date ?? "--"}</div>
                <div className="text-center tabular-nums">{formatDateTime14ToYMDHM(row.requestTime) ?? "--"}</div>
                <div className="text-left text-slate-200">{row.reason ?? "--"}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TrendModal({ target, trendSeries, onClose, periodType, startDate, endDate, granularity }) {
  const summaryRow = target.summaryRow;

  const viewTypeLabel =
    target.viewType === "hospital" ? "병원 전체"
    : target.viewType === "department" ? "진료과별"
    : "교수별";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        className="w-full max-w-[1520px] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,29,0.98),rgba(3,9,20,0.98))] shadow-[0_40px_120px_rgba(2,8,23,0.65)] animate-[modalPop_0.22s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-6 py-5 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-sky-300/85 uppercase">
                {granularity === "weekly" ? "Weekly Trend" : "Daily Trend"}
              </div>
              <h3 className="text-[24px] font-semibold tracking-[-0.03em] text-white lg:text-[30px]">
                {target.label} 운영 추이
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                기준: {getPeriodLabel(periodType, startDate, endDate)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-sky-300/30 hover:bg-white/[0.07] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ModalChip label="현황 유형" value={viewTypeLabel} />
            <ModalChip label="대상" value={target.label} />
            <ModalChip label="조회기간" value={getPeriodLabel(periodType, startDate, endDate)} />
            <ModalChip label="집계 단위" value={granularity === "weekly" ? "주간" : "일별"} />
          </div>
        </div>

        <div className="dashboard-scroll max-h-[calc(92vh-120px)] overflow-y-auto px-6 py-6 lg:px-8">
          <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <SummaryMiniCard title="실 세션" value={formatMetricValue(summaryRow.actualSessions, "건", 0)} accent="from-cyan-500 to-sky-500" glow="rgba(34,211,238,0.18)" icon="activity" />
            <SummaryMiniCard title="세션 가동률" value={formatMetricValue(summaryRow.sessionUtilization, "%", 1)} accent="from-blue-500 to-indigo-500" glow="rgba(96,165,250,0.18)" icon="gauge" />
            <SummaryMiniCard title="평균 진료시간" value={formatMetricValue(summaryRow.avgTreatmentMin, "분", 1)} accent="from-violet-500 to-purple-500" glow="rgba(167,139,250,0.18)" icon="stethoscope" />
            <SummaryMiniCard title="평균 대기시간" value={formatMetricValue(summaryRow.avgWaitMin, "분", 1)} accent="from-pink-500 to-rose-500" glow="rgba(244,114,182,0.18)" icon="clock" />
            <SummaryMiniCard title="초진(병초)" value={formatMetricValue(summaryRow.firstVisitPatients, "명", 0)} accent="from-emerald-500 to-teal-500" glow="rgba(52,211,153,0.18)" icon="users" />
            <SummaryMiniCard title="예약현황 가동률" value={formatMetricValue(summaryRow.bookingRate, "%", 1)} accent="from-amber-500 to-orange-500" glow="rgba(245,158,11,0.18)" icon="calendar" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {TREND_METRICS.map((metric) => (
              <TrendChartCard
                key={metric.key}
                title={metric.title}
                data={trendSeries}
                dataKey={metric.key}
                stroke={metric.stroke}
                fill={metric.fill}
                suffix={metric.suffix}
                decimals={metric.decimals}
                periodType={periodType}
                granularity={granularity}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendChartCard({ title, data, dataKey, stroke, fill, suffix, decimals, periodType, granularity }) {
  const gradientId = `gradient-${dataKey}`;

  return (
    <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,8,23,0.9))] shadow-[0_0_40px_rgba(2,132,199,0.08)]">
      <div className="px-4 pt-4 pb-1">
        <div className="text-[18px] font-semibold text-white">{title}</div>
        <div className="mt-0.5 text-xs text-slate-400">
          {granularity === "weekly" ? "주별 변화 추이" : "일자별 변화 추이"}
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 14, right: 40, left: -14, bottom: 6 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
                <stop offset="100%" stopColor={fill} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              interval={0}
              tickMargin={10}
              height={30}
              padding={{ left: 10, right: 10 }}
              tick={
                granularity === "weekly" ? (
                  <WeeklyTick data={data} />
                ) : (
                  <WeekendAwareTick periodType={periodType} granularity={granularity} lastDate={data[data.length - 1]?.date} />
                )
              }
            />
            <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <Tooltip
              content={
                granularity === "weekly" ? (
                  <WeeklyTrendTooltip suffix={suffix} decimals={decimals} title={title} data={data} />
                ) : (
                  <TrendTooltip suffix={suffix} decimals={decimals} title={title} />
                )
              }
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2.8}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: stroke, stroke: "#ffffff" }}
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WeeklyTick({ x, y, payload, data }) {
  const dateString = payload?.value;
  if (!dateString) return null;

  const entry = data?.find((d) => d.date === dateString);
  const label = entry?.weekLabel || formatAxisDateLabel(dateString);

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

function WeekendAwareTick({ x, y, payload, periodType, granularity, lastDate }) {
  const dateString = payload?.value;
  if (!dateString) return null;

  const color = getDayTextColor(dateString);

  if (granularity === "daily-weekly-tick") {
    const day = Number(dateString.slice(8, 10));
    const isMonday = getDayIndex(dateString) === 1;
    const isFirst = day === 1;
    const isLast = dateString === lastDate;

    if (!isFirst && !isMonday && !isLast) return null;
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill={color} fontSize={11} fontWeight={600}>
        {formatAxisDateLabel(dateString)}
      </text>
    </g>
  );
}

function TrendTooltip({ active, payload, label, suffix, decimals, title }) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0]?.value;

  return (
    <div className="rounded-2xl border border-white/10 bg-[rgba(2,8,23,0.94)] px-4 py-3 shadow-[0_20px_40px_rgba(2,8,23,0.45)] backdrop-blur-xl">
      <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-sky-300 uppercase">{title}</div>
      <div className="text-sm text-slate-300">{formatTooltipDate(label)}</div>
      <div className="mt-2 text-lg font-semibold text-white">{formatMetricValue(value, suffix, decimals)}</div>
    </div>
  );
}

function WeeklyTrendTooltip({ active, payload, label, suffix, decimals, title, data }) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0]?.value;
  const entry = data?.find((d) => d.date === label);
  const weekLabel = entry?.weekLabel || label;

  return (
    <div className="rounded-2xl border border-white/10 bg-[rgba(2,8,23,0.94)] px-4 py-3 shadow-[0_20px_40px_rgba(2,8,23,0.45)] backdrop-blur-xl">
      <div className="mb-1 text-xs font-semibold tracking-[0.08em] text-sky-300 uppercase">{title}</div>
      <div className="text-sm text-slate-300">{weekLabel} 주</div>
      <div className="mt-2 text-lg font-semibold text-white">{formatMetricValue(value, suffix, decimals)}</div>
    </div>
  );
}

const SUMMARY_ICONS = {
  activity: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>),
  gauge: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 7.38 16.75" /><path d="M12 2a10 10 0 0 0-7.38 16.75" /><line x1="12" y1="12" x2="16" y2="8" /><circle cx="12" cy="12" r="1.5" /></svg>),
  stethoscope: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></svg>),
  clock: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>),
  users: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  calendar: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>),
};

function SummaryMiniCard({ title, value, accent = "from-sky-500 to-blue-500", glow = "rgba(56,189,248,0.18)", icon = "activity" }) {
  return (
    <div
      className="group relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(160deg,rgba(15,23,42,0.90),rgba(2,8,23,0.98))] px-5 py-4 transition duration-300 hover:-translate-y-0.5"
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 8px 32px ${glow}`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = `0 0 0 0 transparent`}
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${accent} opacity-80`} />
      <div
        className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-20 blur-2xl transition duration-300 group-hover:opacity-40"
        style={{ background: `radial-gradient(circle, ${glow.replace('0.18', '1')}, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase truncate">{title}</div>
          <div className="mt-2 text-[24px] font-bold tracking-[-0.04em] text-white leading-none">{value}</div>
        </div>
        <div
          className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${accent} bg-opacity-20 text-white opacity-70 group-hover:opacity-100 transition duration-300`}
          style={{ background: `linear-gradient(135deg, ${glow.replace('0.18','0.25')}, ${glow.replace('0.18','0.08')})`, border: `1px solid ${glow.replace('0.18','0.3')}` }}
        >
          {SUMMARY_ICONS[icon]}
        </div>
      </div>
    </div>
  );
}

function ModalChip({ label, value }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

function Cell({ children, className = "", onClick }) {
  return (
    <div
      className={`flex w-full items-center justify-center text-center ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function SortHeader({ label, sortKey, sortConfig, onSort }) {
  const isActive = sortConfig.key === sortKey;
  const arrow = isActive ? (sortConfig.direction === "asc" ? "↑" : "↓") : "";
  const lines = label.split("\n");

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex w-full items-center justify-center gap-1 text-center transition ${
        isActive ? "text-sky-300" : "text-slate-300 hover:text-white"
      }`}
    >
      <span className="flex flex-col items-center leading-tight">
        {lines.map((line, i) => <span key={i}>{line}</span>)}
      </span>
      <span className="min-w-[12px] text-[13px] leading-none lg:text-[14px]">{arrow}</span>
    </button>
  );
}

function MetricBar({ value, booking = false }) {
  const rounded = Math.round(value);
  const tone =
    rounded >= 90
      ? booking ? "from-cyan-400 via-sky-400 to-emerald-400" : "from-emerald-400 via-teal-400 to-cyan-400"
      : rounded >= 80
      ? "from-amber-300 via-yellow-400 to-orange-400"
      : "from-orange-400 via-rose-400 to-red-500";

  const glow =
    rounded >= 90 ? "shadow-[0_0_18px_rgba(34,211,238,0.35)]"
    : rounded >= 80 ? "shadow-[0_0_18px_rgba(250,204,21,0.28)]"
    : "shadow-[0_0_18px_rgba(248,113,113,0.28)]";

  return (
    <div className="group flex w-full items-center gap-3">
      <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-white/5 transition duration-300 group-hover:ring-sky-300/20">
        <div
          className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${tone} ${glow}`}
          style={{ width: `${Math.max(0, Math.min(rounded, 100))}%`, transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <span className="absolute inset-0 animate-[barShine_2.2s_linear_infinite] bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.45),transparent)] opacity-70" />
        </div>
      </div>
      <span className="min-w-[52px] tabular-nums text-[16px] font-semibold text-slate-100">{rounded}%</span>
    </div>
  );
}

function KpiCard({ icon, title, value, accent, delay, suffix = "", decimals = 0 }) {
  const isNumberValue = typeof value === "number" && !Number.isNaN(value);
  const [displayValue, setDisplayValue] = useState(isNumberValue ? 0 : value);

  useEffect(() => {
    if (!isNumberValue) { setDisplayValue(value); return; }

    const end = value;
    const duration = 900;
    const startTime = performance.now();
    let frameId = 0;

    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(end * eased);
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [value, isNumberValue]);

  const formattedValue = isNumberValue
    ? `${Number(displayValue).toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
    : displayValue;

  return (
    <div
      className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,8,23,0.96))] p-4 shadow-[0_0_40px_rgba(2,132,199,0.08)] transition duration-300 hover:-translate-y-1 hover:scale-[1.015] hover:border-sky-400/30 hover:shadow-[0_16px_40px_rgba(2,132,199,0.16)]"
      style={{ animation: "fadeUp 0.7s ease forwards", animationDelay: delay, opacity: 0 }}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_55%)]" />
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-sky-300 transition duration-300 group-hover:scale-110 group-hover:rotate-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-white">{formattedValue}</p>
    </div>
  );
}

function SelectField({ label, value, options, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => { if (event.key === "Escape") setOpen(false); };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={compact ? "relative z-[80] w-[180px]" : "relative z-[80]"}>
      {!compact && (
        <label className="mb-2 block text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`group flex h-[48px] w-full items-center justify-between rounded-[16px] border px-4 text-sm text-white outline-none transition ${
          open
            ? "border-sky-400/70 bg-[linear-gradient(180deg,rgba(12,22,40,0.96),rgba(10,18,34,0.96))] shadow-[0_0_0_3px_rgba(56,189,248,0.12),0_10px_30px_rgba(2,132,199,0.14)]"
            : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] hover:border-sky-300/30 hover:bg-white/[0.07]"
        }`}
      >
        <span className="truncate font-medium text-slate-100">{value}</span>
        <ChevronDown size={16} className={`ml-3 shrink-0 text-slate-400 transition duration-200 ${open ? "rotate-180 text-sky-300" : "group-hover:text-slate-200"}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[56px] z-50 w-full overflow-hidden rounded-[18px] border border-sky-400/20 bg-[linear-gradient(180deg,rgba(10,18,34,0.98),rgba(5,10,20,0.98))] shadow-[0_20px_50px_rgba(2,8,23,0.65),0_0_0_1px_rgba(56,189,248,0.08)] backdrop-blur-xl animate-[dropdownFade_0.18s_ease]">
          <div className="custom-select-scroll max-h-[260px] overflow-y-auto py-2">
            {options.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => { onChange(option); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                    selected ? "bg-sky-400/15 text-white" : "text-slate-200 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="truncate font-medium">{option}</span>
                  <span className="ml-3 w-4 shrink-0">
                    {selected ? <Check size={15} className="text-sky-300" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: "dark" }}
        className="h-[44px] w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-sky-500/50 focus:bg-white/[0.06] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:opacity-60"
      />
    </div>
  );
}

function SourceHelpPopover({ activeView, items }) {
  return (
    <div className="absolute bottom-[calc(100%+12px)] right-0 z-[95] w-[380px] rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,22,40,0.98),rgba(6,12,24,0.98))] p-4 shadow-[0_24px_60px_rgba(2,8,23,0.58)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10 text-sky-300">
          <CircleHelp size={15} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">
            {activeView === "department" ? "진료과별 현황" : "교수별 현황"} 데이터 출처
          </div>
          <div className="text-[12px] text-slate-400">항목별 기준 화면</div>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${activeView}-${item.label}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
            <div className="text-[12px] font-semibold text-slate-200">{item.label}</div>
            <div className="mt-1 text-[12px] leading-relaxed text-slate-400">{item.source}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
        ※ 응급실 경유 및 입원 경유 환자는 집계에서 제외됩니다.
      </div>

      <div className="pointer-events-none absolute bottom-[-7px] right-5 h-4 w-4 rotate-45 border-r border-b border-white/10 bg-[rgba(7,14,27,0.98)]" />
    </div>
  );
}

// 자동 업데이트 스케줄 (KST). backend/src/scheduler.ts SLOTS와 일치 유지.
const SCHEDULE_SLOTS = [
  { time: "00:05", desc: "전날 최종 마감" },
  { time: "08:40" },
  { time: "09:00" },
  { time: "10:30" },
  { time: "11:30" },
  { time: "12:30" },
  { time: "14:00" },
  { time: "15:30" },
  { time: "17:30" },
];

function ScheduleHelpPopover() {
  return (
    <div className="absolute top-[calc(100%+10px)] left-0 z-[95] w-[320px] rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,22,40,0.98),rgba(6,12,24,0.98))] p-4 shadow-[0_24px_60px_rgba(2,8,23,0.58)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10 text-sky-300">
          <CircleHelp size={15} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">자동 업데이트 시각 (KST)</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {SCHEDULE_SLOTS.map((slot) => (
          <div
            key={slot.time}
            className="flex flex-col items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
          >
            <div className="text-[13px] font-semibold tabular-nums text-sky-200">{slot.time}</div>
            {slot.desc && <div className="mt-0.5 text-[11px] text-slate-400">{slot.desc}</div>}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute top-[-7px] left-5 h-4 w-4 rotate-45 border-l border-t border-white/10 bg-[rgba(7,14,27,0.98)]" />
    </div>
  );
}

function Legend({ label, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-12 text-base text-slate-400">
      {text}
    </div>
  );
}

function getPeriodLabel(periodType, start, end) {
  if (periodType === "daily") return "일간";
  if (periodType === "weekly") return "주간";
  if (periodType === "monthly") return "월간";
  return `${start} ~ ${end}`;
}

function sortRows(rows, sortConfig) {
  const { key, direction } = sortConfig;
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];

    const aMissing = aValue === undefined || aValue === null || aValue === "";
    const bMissing = bValue === undefined || bValue === null || bValue === "";

    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    if (typeof aValue === "string" && typeof bValue === "string") {
      return aValue.localeCompare(bValue, "ko") * multiplier;
    }

    return (Number(aValue) - Number(bValue)) * multiplier;
  });
}
