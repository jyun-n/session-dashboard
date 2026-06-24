import { XMLParser } from "fast-xml-parser";
import { env } from "../config/env.js";

const BASE_URL     = env.EMR_BASE_URL;
const BASE_URL_EDU = env.EMR_BASE_URL_EDU;  // 보조 호출 전용 (운영 적용 전 임시 교육 URL)
const INST_CD      = env.EMR_INST_CD;

const parser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: "__cdata",
});

export function hhmiToMin(hhmi: string | null | undefined): number | null {
  if (!hhmi || hhmi.trim() === "" || hhmi === "0000") return null;
  const padded = hhmi.padStart(4, "0");
  const hours = parseInt(padded.slice(0, 2), 10);
  const mins  = parseInt(padded.slice(2, 4), 10);
  return hours * 60 + mins;
}

export function minToHhmi(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}${m}`;
}

function parseXml(xml: string): unknown[] {
  const parsed = parser.parse(xml);
  const root = parsed?.root;
  if (!root) return [];
  const result = root.result;
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

function cdata(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "__cdata" in val) {
    return String((val as Record<string, unknown>)["__cdata"] ?? "");
  }
  return String(val);
}

export interface RawPatientRow {
  doctorId:    string;
  doctorName:  string;
  deptCd:      string;
  deptName:    string;
  fsexamFlag:  string;
  avgOrdTime:  string | null;
  avgWaitTime: string | null;
  avgOrdMin:   number | null;
  avgWaitMin:  number | null;
  patCnt:      number;
}

export async function fetchPatientStats(
  yyyymmdd: string
): Promise<RawPatientRow[]> {
  const url = `${BASE_URL}?submit_id=DRPMA00100&business_id=pm&instcd=${INST_CD}&fromdd=${yyyymmdd}&todd=${yyyymmdd}&orddeptcd=`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`DRPMA00100 호출 실패: ${res.status}`);

  const xml = await res.text();
  const rows = parseXml(xml);

  return rows.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    const avgOrdTime  = cdata(r.avgordtime)  || null;
    const avgWaitTime = cdata(r.avgwaittime) || null;

    return {
      doctorId:    cdata(r.orddrid),
      doctorName:  cdata(r.orddrnm),
      deptCd:      cdata(r.orddeptcd),
      deptName:    cdata(r.orddeptnm),
      fsexamFlag:  cdata(r.fsexamflag),
      avgOrdTime,
      avgWaitTime,
      avgOrdMin:   hhmiToMin(avgOrdTime),
      avgWaitMin:  hhmiToMin(avgWaitTime),
      patCnt:      parseInt(cdata(r.patcnt) || "0", 10),
    };
  });
}

export interface RawSessionRow {
  statDate:         string;   // basedd
  deptCd:           string;
  deptName:         string;
  doctorId:         string;
  doctorName:       string;
  planSession:      number;
  realSession:      number;
  totalExamCap:     number;   // totalexamcap
  closeReason:      string | null;  // ordendresn
  closeRequestTime: string | null;  // lastupdtdt (YYYYMMDDHHMMSS 14자리)
}

export async function fetchSessions(
  fromdd: string,
  todd: string,
): Promise<RawSessionRow[]> {
  const url = `${BASE_URL}?submit_id=DRPMA00200&business_id=pm&instcd=${INST_CD}&fromdd=${fromdd}&todd=${todd}&orddeptcd=`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`DRPMA00200 호출 실패: ${res.status}`);

  const xml = await res.text();
  const rows = parseXml(xml);

  return rows.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      statDate:         cdata(r.basedd),          // enddd → basedd
      deptCd:           cdata(r.orddeptcd),
      deptName:         cdata(r.orddeptnm),
      doctorId:         cdata(r.orddrid),
      doctorName:       cdata(r.orddrnm),
      planSession:      parseInt(cdata(r.plansession)   || "0", 10),
      realSession:      parseInt(cdata(r.realsession)   || "0", 10),
      totalExamCap:     parseInt(cdata(r.totalexamcap)  || "0", 10),
      closeReason:      cdata(r.ordendresn) || null,
      closeRequestTime: cdata(r.lastupdtdt) || null,
    };
  });
}

// DRPMA00200 보조 호출 — 마감 2개 필드만 추출하여 RawSession에 머지.
// 같은 (statDate, doctorId, deptCd) 키로 매핑해 메인 응답에 합침.
export interface RawCloseInfoRow {
  statDate:         string;        // basedd
  deptCd:           string;
  doctorId:         string;
  closeReason:      string | null; // ordendresn
  closeRequestTime: string | null; // lastupdtdt (YYYYMMDDHHMMSSXXX 17자리 — 밀리초 포함)
}

export async function fetchCloseInfo(fromdd: string, todd: string): Promise<RawCloseInfoRow[]> {
  const url = `${BASE_URL}?submit_id=DRPMA00200&business_id=pm&instcd=${INST_CD}&fromdd=${fromdd}&todd=${todd}&orddeptcd=`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`DRPMA00200(마감) 호출 실패: ${res.status}`);

  const xml  = await res.text();
  const rows = parseXml(xml);

  return rows.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      statDate:         cdata(r.basedd),
      deptCd:           cdata(r.orddeptcd),
      doctorId:         cdata(r.orddrid),
      closeReason:      cdata(r.ordendresn) || null,
      closeRequestTime: cdata(r.lastupdtdt) || null,
    };
  });
}

// DRPMA00200 보조 호출 — 오전/오후 진료 시작·종료시간(HHMM 4자리) 4필드만 추출.
// 운영 EMR에 신규 필드가 적용되기 전 임시로 교육 URL(EMR_BASE_URL_EDU) 사용.
// 운영 적용 후 EMR_BASE_URL_EDU만 운영 URL로 바꾸면 자동 통일.
export interface RawSessionTimeRow {
  statDate:           string;        // basedd
  deptCd:             string;
  doctorId:           string;
  morningStartTime:   string | null; // amsttm (HHMM)
  morningEndTime:     string | null; // amedtm
  afternoonStartTime: string | null; // pmsttm
  afternoonEndTime:   string | null; // pmedtm
}

export async function fetchSessionTimes(fromdd: string, todd: string): Promise<RawSessionTimeRow[]> {
  const url = `${BASE_URL_EDU}?submit_id=DRPMA00200&business_id=pm&instcd=${INST_CD}&fromdd=${fromdd}&todd=${todd}&orddeptcd=`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`DRPMA00200(진료시간) 호출 실패: ${res.status}`);

  const xml  = await res.text();
  const rows = parseXml(xml);

  return rows.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      statDate:           cdata(r.basedd),
      deptCd:             cdata(r.orddeptcd),
      doctorId:           cdata(r.orddrid),
      morningStartTime:   cdata(r.amsttm) || null,
      morningEndTime:     cdata(r.amedtm) || null,
      afternoonStartTime: cdata(r.pmsttm) || null,
      afternoonEndTime:   cdata(r.pmedtm) || null,
    };
  });
}

// DRPMA00100 srchflag=T — 교수별 진료 시작/종료시간.
// (yyyymmdd, deptCd, doctorId) 3종 필수 (담당자 가이드: 누락 시 데이터량 폭증으로 오류).
// 응답은 환자별 진료 이벤트 row가 다수 — 동일 의사에 여러 row 가능. 합쳐서 MIN/MAX는 호출자(collect)가 처리.
// 1일치씩 호출하므로 응답에 날짜 필드가 없어도 입력 yyyymmdd를 그대로 statDate로 사용.
export interface RawDoctorTimeRow {
  statDate:           string;        // 입력 yyyymmdd 그대로
  deptCd:             string;
  deptName:           string;
  doctorId:           string;
  doctorName:         string;
  treatmentStartTime: string | null; // ordstartdt (YYYYMMDDHHMMSS 14자리)
  treatmentEndTime:   string | null; // dracptdt  (YYYYMMDDHHMMSS 14자리)
}

export async function fetchDoctorTimes(
  yyyymmdd: string,
  deptCd:   string,
  doctorId: string,
): Promise<RawDoctorTimeRow[]> {
  const url =
    `${BASE_URL}?submit_id=DRPMA00100&business_id=pm&instcd=${INST_CD}` +
    `&srchflag=T&fromdd=${yyyymmdd}&todd=${yyyymmdd}` +
    `&orddeptcd=${encodeURIComponent(deptCd)}&orddrid=${encodeURIComponent(doctorId)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`DRPMA00100(T) 호출 실패: ${res.status}`);

  const xml  = await res.text();
  const rows = parseXml(xml);

  return rows.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      statDate:           yyyymmdd,
      deptCd:             cdata(r.orddeptcd),
      deptName:           cdata(r.orddeptnm),
      doctorId:           cdata(r.orddrid),
      doctorName:         cdata(r.orddrnm),
      treatmentStartTime: cdata(r.ordstartdt) || null,
      treatmentEndTime:   cdata(r.dracptdt)   || null,
    };
  });
}