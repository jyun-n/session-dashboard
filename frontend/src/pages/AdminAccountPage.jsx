import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  History,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";
import { clearAuth } from "../services/authService";
import {
  getAccounts,
  resetAccountPassword,
  deleteAccount,
  createAccount,
  updateAccount,
  getAllLoginLogs,
} from "../services/accountService";

export default function AdminAccountPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("manage");
  const [accounts, setAccounts] = useState([]);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [deleteSecret, setDeleteSecret] = useState("");
  const [editForm, setEditForm] = useState({ dept: "", position: "" });
  const [loginLogs, setLoginLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [modalError, setModalError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showDeleteSecret, setShowDeleteSecret] = useState(false);

  const [createForm, setCreateForm] = useState({
    empNo: "",
    dept: "",
    position: "",
    name: "",
    id: "",
    password: "",
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  const [toast, setToast] = useState({
    show: false,
    message: "",
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (!toast.show) return;

    const timer = setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 2500);

    return () => clearTimeout(timer);
  }, [toast]);

  const loadAccounts = async () => {
    const data = await getAccounts();
    setAccounts(data);
  };

  const showToast = (message) => {
    setToast({ show: true, message });
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const openResetModal = (account) => {
    setSelectedAccount(account);
    setNewPassword("");
    setModalError("");
    setShowNewPassword(false);
    setResetModalOpen(true);
  };

  const openDeleteModal = (account) => {
    setSelectedAccount(account);
    setDeleteSecret("");
    setModalError("");
    setShowDeleteSecret(false);
    setDeleteModalOpen(true);
  };

  const openEditModal = (account) => {
    setSelectedAccount(account);
    setEditForm({ dept: account.dept ?? "", position: account.position ?? "" });
    setModalError("");
    setEditModalOpen(true);
  };

  const openLogsModal = async () => {
    setLoginLogs([]);
    setLogsError("");
    setLogsLoading(true);
    setLogsModalOpen(true);

    const result = await getAllLoginLogs();
    setLogsLoading(false);

    if (!result.success) {
      setLogsError(result.message);
      return;
    }
    setLoginLogs(result.logs);
  };

  const handleUpdateAccount = async () => {
    const dept = editForm.dept.trim();
    const position = editForm.position.trim();

    if (!dept || !position) {
      setModalError("소속과 직책을 모두 입력해주세요.");
      return;
    }

    const result = await updateAccount(selectedAccount.id, { dept, position });

    if (!result.success) {
      setModalError(result.message);
      return;
    }

    setEditModalOpen(false);
    setSelectedAccount(null);
    setEditForm({ dept: "", position: "" });
    setModalError("");
    await loadAccounts();
    showToast("회원 정보가 수정되었습니다.");
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setModalError("새 비밀번호를 입력해주세요.");
      return;
    }

    const result = await resetAccountPassword(selectedAccount.id, newPassword);

    if (!result.success) {
      setModalError(result.message);
      return;
    }

    setResetModalOpen(false);
    setSelectedAccount(null);
    setNewPassword("");
    setModalError("");
    await loadAccounts();
    showToast("비밀번호가 변경되었습니다.");
  };

  const handleDeleteAccount = async () => {
    if (!deleteSecret.trim()) {
      setModalError("탈퇴 비밀번호를 입력해주세요.");
      return;
    }

    const result = await deleteAccount(selectedAccount.id, deleteSecret);

    if (!result.success) {
      setModalError(result.message);
      return;
    }

    setDeleteModalOpen(false);
    setSelectedAccount(null);
    setDeleteSecret("");
    setModalError("");
    await loadAccounts();
    showToast("계정이 탈퇴 처리되었습니다.");
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateMessage("");

    const { empNo, dept, position, name, id, password } = createForm;

    if (!empNo || !dept || !position || !name || !id || !password) {
      setCreateError("모든 항목을 입력해주세요.");
      return;
    }

    const result = await createAccount(createForm);

    if (!result.success) {
      setCreateError(result.message);
      return;
    }

    setCreateMessage("계정이 생성되었습니다.");
    setCreateForm({
      empNo: "",
      dept: "",
      position: "",
      name: "",
      id: "",
      password: "",
    });
    setShowCreatePassword(false);

    await loadAccounts();
    setActiveTab("manage");
    showToast("계정이 생성되었습니다.");
  };

  const handleCreateInputChange = (key, value) => {
    if (key === "empNo") {
      const onlyNumbers = value.replace(/[^0-9]/g, "");
      setCreateForm((prev) => ({ ...prev, empNo: onlyNumbers }));
      return;
    }
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_25%),linear-gradient(135deg,#030712_0%,#07111f_45%,#030712_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(96,165,250,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.2)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-sky-500/[0.06] blur-[120px]" />

        {toast.show && (
          <div className="fixed left-1/2 top-6 z-[60] -translate-x-1/2">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-[#0b1728]/95 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <p className="text-sm font-medium text-slate-100">{toast.message}</p>
            </div>
          </div>
        )}

        <div className="relative z-10 mx-auto max-w-[1360px] px-5 py-8 lg:px-10 lg:py-10">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-400/15 bg-sky-400/8 px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] text-sky-300/80 uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400/80 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
                Admin Console
              </div>
              <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-white lg:text-[34px]">
                계정 관리
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                관리자 계정 생성, 비밀번호 재설정, 탈퇴 처리를 관리합니다.
              </p>
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

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,8,23,0.96))] p-4 shadow-[0_0_80px_rgba(2,132,199,0.08)] backdrop-blur-2xl lg:p-6">
            <div className="mb-6 inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("manage")}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === "manage"
                    ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                계정 관리
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === "create"
                    ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                계정 생성
              </button>
            </div>

            {activeTab === "manage" ? (
              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.025]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-center">
                    <thead>
                      <tr className="bg-white/[0.03] text-[13px] font-semibold tracking-[0.04em] text-slate-300">
                        <th className="border-b border-r border-white/10 px-4 py-4">순번</th>
                        <th className="border-b border-r border-white/10 px-4 py-4">사번</th>
                        <th className="border-b border-r border-white/10 px-4 py-4">소속</th>
                        <th className="border-b border-r border-white/10 px-4 py-4">직책</th>
                        <th className="border-b border-r border-white/10 px-4 py-4">성명</th>
                        <th className="border-b border-r border-white/10 px-4 py-4">아이디</th>
                        <th className="border-b border-white/10 px-4 py-4">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account, index) => (
                        <tr
                          key={account.id}
                          className="text-[15px] text-slate-100 transition hover:bg-white/[0.03]"
                        >
                          <td className="border-b border-r border-white/10 px-4 py-5">
                            <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-semibold text-slate-300">
                              {index + 1}
                            </span>
                          </td>
                          <td className="border-b border-r border-white/10 px-4 py-5">
                            {account.empNo}
                          </td>
                          <td className="border-b border-r border-white/10 px-4 py-5">
                            {account.dept}
                          </td>
                          <td className="border-b border-r border-white/10 px-4 py-5">
                            {account.position}
                          </td>
                          <td className="border-b border-r border-white/10 px-4 py-5 font-medium text-white">
                            {account.name}
                          </td>
                          <td className="border-b border-r border-white/10 px-4 py-5">
                            <span className="inline-flex items-center rounded-full border border-sky-400/18 bg-sky-400/8 px-3 py-1 text-sm font-medium text-sky-200">
                              {account.loginId}
                            </span>
                          </td>
                          <td className="border-b border-white/10 px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              {account.role !== "ADMIN" && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(account)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:border-sky-300/30 hover:bg-sky-500/[0.08] hover:text-white"
                                >
                                  <Pencil size={14} />
                                  수정
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openResetModal(account)}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] transition hover:brightness-110"
                              >
                                <KeyRound size={14} />
                                비밀번호 재설정
                              </button>
                              {account.role === "ADMIN" && (
                                <button
                                  type="button"
                                  onClick={openLogsModal}
                                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:border-emerald-300/30 hover:bg-emerald-500/[0.08] hover:text-white"
                                >
                                  <History size={14} />
                                  로그 보기
                                </button>
                              )}
                              {account.role !== "ADMIN" && (
                                <button
                                  type="button"
                                  onClick={() => openDeleteModal(account)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:border-rose-400/25 hover:bg-rose-500/[0.08] hover:text-white"
                                >
                                  <Trash2 size={14} />
                                  탈퇴
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}

                      {Array.from({ length: Math.max(0, 5 - accounts.length) }).map(
                        (_, index) => (
                          <tr key={index} className="h-[72px]">
                            <td className="border-b border-r border-white/10" />
                            <td className="border-b border-r border-white/10" />
                            <td className="border-b border-r border-white/10" />
                            <td className="border-b border-r border-white/10" />
                            <td className="border-b border-r border-white/10" />
                            <td className="border-b border-r border-white/10" />
                            <td className="border-b border-white/10" />
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <form
                  onSubmit={handleCreateAccount}
                  className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
                      <Plus size={18} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">신규 계정 생성</h2>
                      <p className="text-sm text-slate-400">
                        계정에 필요한 기본 정보를 입력하세요.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ["사번", "empNo", "예: 19784"],
                      ["소속", "dept", "예: 디지털전략팀"],
                      ["직책", "position", "예: 서기"],
                      ["성명", "name", "예: 이지윤"],
                      ["아이디", "id", "예: jyun"],
                    ].map(([label, key, placeholder]) => (
                      <div key={key}>
                        <label className="mb-2 block text-[12px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                          {label}
                        </label>
                        <input
                          type="text"
                          value={createForm[key]}
                          placeholder={placeholder}
                          onChange={(e) => handleCreateInputChange(key, e.target.value)}
                          className="h-[52px] w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-[14px] text-white outline-none transition duration-200 placeholder:text-slate-600 focus:border-sky-500/50 focus:bg-white/[0.06] focus:shadow-[0_0_0_1px_rgba(56,189,248,0.2),0_0_20px_rgba(56,189,248,0.10)]"
                        />
                      </div>
                    ))}

                    <div>
                      <label className="mb-2 block text-[12px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                        비밀번호
                      </label>
                      <div className="relative">
                        <input
                          type={showCreatePassword ? "text" : "password"}
                          value={createForm.password}
                          placeholder="초기 비밀번호 입력"
                          onChange={(e) => handleCreateInputChange("password", e.target.value)}
                          className="h-[52px] w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 pr-12 text-[14px] text-white outline-none transition duration-200 placeholder:text-slate-600 focus:border-sky-500/50 focus:bg-white/[0.06] focus:shadow-[0_0_0_1px_rgba(56,189,248,0.2),0_0_20px_rgba(56,189,248,0.10)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCreatePassword((prev) => !prev)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-sky-300"
                          aria-label={showCreatePassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                        >
                          {showCreatePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {(createError || createMessage) && (
                    <div className="mt-5 space-y-2">
                      {createError && (
                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-400">
                          {createError}
                        </div>
                      )}
                      {createMessage && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-400">
                          {createMessage}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(37,99,235,0.26)] transition duration-200 hover:brightness-110"
                    >
                      <Plus size={16} />
                      계정 생성
                    </button>
                  </div>
                </form>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">생성 규칙</h2>
                      <p className="text-sm text-slate-400">
                        계정 생성 시 반드시 확인해야 할 기준입니다.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-slate-300">
                    <RuleItem text="아이디는 중복 없이 고유하게 생성되어야 합니다." />
                    <RuleItem text="사번도 중복 없이 고유하게 생성되어야 합니다." />
                    <RuleItem text="사번은 숫자만 입력할 수 있습니다." />
                    <RuleItem text="사번, 소속, 직책, 성명, 아이디, 비밀번호는 모두 필수 입력 항목입니다." />
                    <RuleItem text="초기 비밀번호는 생성 후 계정 관리 탭에서 재설정할 수 있습니다." />
                    <RuleItem text="생성된 계정은 계정 관리 탭에서 바로 확인할 수 있습니다." />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 회원 정보 수정 모달 */}
        {editModalOpen && (
          <Modal title="회원 정보 수정" onClose={() => setEditModalOpen(false)}>
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-white">{selectedAccount?.name}</span>{" "}
              ({selectedAccount?.loginId}) 계정의 소속과 직책을 수정합니다.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-[12px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                  소속
                </label>
                <input
                  type="text"
                  value={editForm.dept}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, dept: e.target.value }))
                  }
                  placeholder="예: 디지털전략팀"
                  className="h-[54px] w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-[14px] text-white outline-none transition duration-200 placeholder:text-slate-600 focus:border-sky-500/50 focus:bg-white/[0.06]"
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                  직책
                </label>
                <input
                  type="text"
                  value={editForm.position}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, position: e.target.value }))
                  }
                  placeholder="예: 서기"
                  className="h-[54px] w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-[14px] text-white outline-none transition duration-200 placeholder:text-slate-600 focus:border-sky-500/50 focus:bg-white/[0.06]"
                />
              </div>
            </div>

            {modalError && <p className="mt-3 text-sm text-rose-400">{modalError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleUpdateAccount}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                변경
              </button>
            </div>
          </Modal>
        )}

        {/* 전체 로그인 기록 모달 */}
        {logsModalOpen && (
          <Modal title="로그인 기록 (전체 계정)" onClose={() => setLogsModalOpen(false)} size="large">
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              최근 로그인 기록을 최신순으로 보여줍니다.
            </p>

            {logsLoading ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-400">
                로그를 불러오는 중...
              </div>
            ) : logsError ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-400">
                {logsError}
              </div>
            ) : loginLogs.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-400">
                로그인 기록이 없습니다.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[16px] border border-white/10">
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-[13px]">
                    <colgroup>
                      <col className="w-[170px]" />
                      <col />
                      <col className="w-[120px]" />
                      <col />
                      <col className="w-[160px]" />
                    </colgroup>
                    <thead className="sticky top-0 bg-[#0b1728]">
                      <tr className="text-[12px] font-semibold tracking-[0.04em] text-slate-300">
                        <th className="border-b border-r border-white/10 px-4 py-3 whitespace-nowrap">접속 시각</th>
                        <th className="border-b border-r border-white/10 px-4 py-3">성명</th>
                        <th className="border-b border-r border-white/10 px-4 py-3">아이디</th>
                        <th className="border-b border-r border-white/10 px-4 py-3">소속 / 직책</th>
                        <th className="border-b border-white/10 px-4 py-3">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLogs.map((log) => (
                        <tr key={log.id} className="text-slate-100">
                          <td className="border-b border-r border-white/10 px-4 py-3 font-medium text-white whitespace-nowrap">
                            {formatLoginAt(log.loginAt)}
                          </td>
                          <td className="border-b border-r border-white/10 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {log.account?.name || "-"}
                              </span>
                              {log.account?.role === "ADMIN" && (
                                <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/8 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-sky-200 uppercase">
                                  Admin
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border-b border-r border-white/10 px-4 py-3">
                            <span className="inline-flex items-center rounded-full border border-sky-400/18 bg-sky-400/8 px-2.5 py-0.5 text-[12px] font-medium text-sky-200">
                              {log.account?.loginId || "-"}
                            </span>
                          </td>
                          <td className="border-b border-r border-white/10 px-4 py-3 text-slate-300">
                            {log.account?.dept || "-"} / {log.account?.position || "-"}
                          </td>
                          <td className="border-b border-white/10 px-4 py-3 text-slate-300 whitespace-nowrap">
                            {log.ipAddress || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setLogsModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                닫기
              </button>
            </div>
          </Modal>
        )}

        {/* 비밀번호 재설정 모달 */}
        {resetModalOpen && (
          <Modal title="비밀번호 재설정" onClose={() => setResetModalOpen(false)}>
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-white">{selectedAccount?.name}</span>{" "}
              ({selectedAccount?.loginId}) 계정의 새 비밀번호를 입력하세요.
            </p>

            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                className="h-[54px] w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 pr-12 text-[14px] text-white outline-none transition duration-200 placeholder:text-slate-600 focus:border-sky-500/50 focus:bg-white/[0.06]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-sky-300"
                aria-label={showNewPassword ? "새 비밀번호 숨기기" : "새 비밀번호 보기"}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {modalError && <p className="mt-3 text-sm text-rose-400">{modalError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                변경
              </button>
            </div>
          </Modal>
        )}

        {/* 계정 탈퇴 모달 */}
        {deleteModalOpen && (
          <Modal title="계정 탈퇴" onClose={() => setDeleteModalOpen(false)}>
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-white">{selectedAccount?.name}</span>{" "}
              ({selectedAccount?.loginId}) 계정을 탈퇴 처리하려면 비밀번호를 입력하세요.
            </p>

            <div className="relative">
              <input
                type={showDeleteSecret ? "text" : "password"}
                value={deleteSecret}
                onChange={(e) => setDeleteSecret(e.target.value)}
                placeholder="탈퇴 비밀번호 입력"
                className="h-[54px] w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 pr-12 text-[14px] text-white outline-none transition duration-200 placeholder:text-slate-600 focus:border-sky-500/50 focus:bg-white/[0.06]"
              />
              <button
                type="button"
                onClick={() => setShowDeleteSecret((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-sky-300"
                aria-label={showDeleteSecret ? "탈퇴 비밀번호 숨기기" : "탈퇴 비밀번호 보기"}
              >
                {showDeleteSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {modalError && <p className="mt-3 text-sm text-rose-400">{modalError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                탈퇴
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function RuleItem({ text }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="mt-1 h-2 w-2 rounded-full bg-sky-400/80" />
      <p className="leading-relaxed text-slate-300">{text}</p>
    </div>
  );
}

function formatLoginAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function Modal({ title, children, onClose, size = "default" }) {
  const widthClass = size === "large" ? "max-w-[820px]" : "max-w-[520px]";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className={`w-full ${widthClass} rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,8,23,0.99))] p-6 shadow-[0_0_60px_rgba(2,132,199,0.12)] backdrop-blur-2xl`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
