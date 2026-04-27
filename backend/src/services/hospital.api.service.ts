import { XMLParser } from "fast-xml-parser";

const BASE_URL = "http://emr124eduote.cauhs.or.kr/cmcnu/.live";
const INST_CD = "124";

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
  statDate:    string;
  deptCd:      string;
  deptName:    string;
  doctorId:    string;
  doctorName:  string;
  planSession: number;
  realSession: number;
  fstExamCap:  number;
  reExamCap:   number;
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
      statDate:    cdata(r.enddd),
      deptCd:      cdata(r.orddeptcd),
      deptName:    cdata(r.orddeptnm),
      doctorId:    cdata(r.orddrid),
      doctorName:  cdata(r.orddrnm),
      planSession: parseInt(cdata(r.plansession) || "0", 10),
      realSession: parseInt(cdata(r.realsession) || "0", 10),
      fstExamCap:  parseInt(cdata(r.fstexamcap)  || "0", 10),
      reExamCap:   parseInt(cdata(r.reexamcap)   || "0", 10),
    };
  });
}