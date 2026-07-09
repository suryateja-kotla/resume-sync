import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

const highlights = [
  {
    title: "AI Resume Intelligence",
    description:
      "Extract candidate skills, experience and insights in seconds.",
  },
  {
    title: "Smart Talent Search",
    description:
      "Quickly identify the best candidates using AI powered search.",
  },
  {
    title: "Centralized Hiring",
    description: "Manage resumes, interviews and employees from one platform.",
  },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      login(
        {
          email: data.email,
          role: data.role,
          employeeId: data.employee_id ?? null,
          fullName: data.full_name ?? null,
          mustChangePassword: data.must_change_password ?? false,
        },
        data.access_token,
        data.refresh_token,
      );

      if (data.must_change_password) {
        navigate("/change-password");
        return;
      }

      navigate(data.role === "HR" ? "/hr-dashboard" : "/employee-dashboard");
    } catch (err: any) {
      const msg = err.response?.data?.detail;

      if (err.response?.status === 429) {
        setError(
          "Too many login attempts. Please wait 15 minutes and try again.",
        );
      } else if (err.response?.status === 403) {
        setError(msg || "Your account is inactive. Contact HR.");
      } else {
        setError("Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-indigo-50 to-white p-0 sm:p-3">
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px] overflow-hidden rounded-none bg-white shadow-[0_30px_100px_rgba(79,70,229,0.18)] sm:min-h-[calc(100vh-24px)] sm:rounded-[32px] lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        {/* LEFT PANEL — hidden below lg so the login form gets full width on mobile/tablet */}

        <div className="relative hidden overflow-hidden bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 text-white lg:block">
          <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-pink-400/10 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-2 backdrop-blur">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 p-1.5">
                  <img src="/syncfolio-mark.svg" alt="" className="h-full w-full" />
                </div>

                <span className="font-semibold">SyncFolio</span>
              </div>

              <h1 className="mt-10 text-4xl font-bold leading-tight xl:mt-12 xl:text-5xl">
                Modern Hiring.
                <br />
                Smarter Recruitment.
              </h1>

              <p className="mt-6 max-w-xl text-base text-violet-100 leading-8 xl:text-lg">
                Manage resumes, employees and recruitment workflows from one
                intelligent AI-powered platform.
              </p>
            </div>

            <div className="grid gap-4 xl:gap-5">
              {highlights.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl xl:p-5"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg">{item.title}</h3>

                    <p className="mt-1 text-violet-100">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}

        <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-white via-violet-50 to-indigo-50 px-4 py-8 sm:px-8 sm:py-12 lg:px-10">
          <div className="w-full max-w-lg">
            <div className="mb-6 sm:mb-8">
              {/* Brand mark, shown only when the left marketing panel is hidden */}
              <div className="mb-6 inline-flex items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 p-1.5 shadow-md">
                  <img src="/syncfolio-mark.svg" alt="" className="h-full w-full" />
                </div>

                <span className="font-semibold text-slate-800">SyncFolio</span>
              </div>

              <div className="hidden h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-2.5 shadow-lg lg:flex">
                <img src="/syncfolio-mark.svg" alt="" className="h-full w-full" />
              </div>

              <h2 className="mt-4 text-3xl font-bold text-slate-800 sm:mt-6 sm:text-4xl">
                Welcome Back
              </h2>

              <p className="mt-2 text-sm text-slate-500 sm:text-base">
                Sign in to continue to SyncFolio.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl space-y-5 sm:p-8 sm:space-y-6"
            >
              {/* Email */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email Address
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
                    <svg
                      className="h-5 w-5 text-violet-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 12H8m8-4H8m8 8H8m13-10v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2z"
                      />
                    </svg>
                  </div>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@sailssoftware.com"
                    required
                    autoFocus
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-14 pr-4 text-slate-700 transition focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                  />
                </div>
              </div>

              {/* Password */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
                    <svg
                      className="h-5 w-5 text-violet-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m6-6V9a6 6 0 10-12 0v2M5 11h14v9H5z"
                      />
                    </svg>
                  </div>

                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-14 pr-14 text-slate-700 transition focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                  />

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-violet-600"
                  >
                    {showPass ? (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L3 3m18 18L3 3"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="mt-3 flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-violet-600 transition hover:text-violet-800"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              {/* Error */}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Submit */}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-semibold text-white shadow-lg transition hover:scale-[1.01] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg
                      className="mr-3 h-5 w-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="opacity-25"
                      />

                      <path
                        fill="currentColor"
                        className="opacity-75"
                        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
                      />
                    </svg>
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Footer */}

            <div className="mt-6 rounded-3xl border border-violet-100 bg-white/80 p-4 shadow-sm backdrop-blur sm:mt-8 sm:p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M5.636 18.364A9 9 0 1118.364 5.636 9 9 0 015.636 18.364z"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">Secure Login</p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Use your company credentials to securely access your
                    SyncFolio dashboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center sm:mt-8">
              <p className="text-sm text-slate-500">Default Password</p>

              <p className="mt-2 inline-flex rounded-xl bg-slate-100 px-4 py-2 font-mono text-sm font-semibold text-slate-700">
                Sails@&lt;EmployeeID&gt;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
