import { useState } from "react";
import { SettingsModal, SettingsIcon } from "./SettingsModal.jsx";

export function RegisterScreen({ onRegister, onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !password || !passwordConfirm || !fullName.trim() || loading) return;

    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onRegister(email.trim(), password, fullName.trim());
    } catch (err) {
      const message = String(err?.message || "");
      if (message.includes("email_already_exists") || message.includes("user_already_exists")) {
        setError("This email is already registered");
      } else {
        setError("Registration failed. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <main className="login-root">
      <form className="login-card" onSubmit={handleSubmit}>
        <svg className="login-logo" width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3ZM9.09277 16.3965C8.64171 16.3966 8.2706 16.7584 8.27051 17.2158C8.27051 17.667 8.64165 18.0321 9.09277 18.0322C9.54717 18.0322 9.91504 17.667 9.91504 17.2158C9.91494 16.7583 9.54711 16.3965 9.09277 16.3965ZM12.7432 16.3965C12.292 16.3965 11.921 16.7583 11.9209 17.2158C11.9209 17.667 12.292 18.0322 12.7432 18.0322C13.1975 18.0321 13.5654 17.6669 13.5654 17.2158C13.5653 16.7584 13.1974 16.3966 12.7432 16.3965ZM16.0527 16.3965C15.6016 16.3965 15.2296 16.7583 15.2295 17.2158C15.2295 17.667 15.6015 18.0322 16.0527 18.0322C16.5069 18.032 16.875 17.6669 16.875 17.2158C16.8749 16.7584 16.5069 16.3967 16.0527 16.3965ZM11.2393 15.6641C11.2105 15.6641 11.1914 15.6832 11.1914 15.7119V16.5566C11.0955 16.4607 10.9704 16.4005 10.8105 16.4004C10.3723 16.4004 10.052 16.7614 10.0518 17.2188C10.0518 17.67 10.3721 18.0225 10.8105 18.0225C11.0055 18.0224 11.1433 17.9459 11.2393 17.834L11.2549 17.9521C11.2581 17.9808 11.2741 17.9999 11.3027 18H11.6709C11.6996 18 11.7187 17.9809 11.7188 17.9521V15.7119C11.7187 15.6832 11.6997 15.6641 11.6709 15.6641H11.2393ZM14.5078 16.4004C14.0568 16.4006 13.7022 16.7553 13.7021 17.2031C13.7021 17.6606 14.0568 18.0223 14.5078 18.0225C14.7574 18.0225 14.9788 17.9137 15.126 17.7441C15.1451 17.7218 15.1421 17.6959 15.123 17.6768L14.8604 17.4238C14.838 17.4015 14.8155 17.4048 14.79 17.4238C14.7005 17.5006 14.6139 17.5293 14.5244 17.5293C14.342 17.5293 14.2109 17.3855 14.2109 17.2031C14.211 17.0304 14.342 16.8896 14.5244 16.8896C14.6075 16.8897 14.6939 16.9184 14.7803 16.9951C14.8058 17.0175 14.8282 17.0241 14.8506 17.002L15.1133 16.7451C15.1321 16.726 15.1351 16.7009 15.1162 16.6787C14.969 16.5091 14.751 16.4004 14.5078 16.4004ZM7.39648 15.9521C7.36786 15.9523 7.34863 15.9713 7.34863 16V16.4316H7.09277C7.06399 16.4317 7.04492 16.4517 7.04492 16.4805V16.8096C7.04492 16.8384 7.06399 16.8574 7.09277 16.8574H7.34863V17.9521C7.3487 17.9808 7.36791 17.9999 7.39648 18H7.8291C7.85768 17.9999 7.87689 17.9808 7.87695 17.9521V16.8574H8.13281C8.16161 16.8574 8.18066 16.8384 8.18066 16.8096V16.4805C8.18066 16.4517 8.16161 16.4316 8.13281 16.4316H7.87695V16C7.87695 15.9713 7.85773 15.9523 7.8291 15.9521H7.39648ZM9.09277 16.8867C9.26552 16.8867 9.40616 17.0239 9.40625 17.2158C9.40625 17.4014 9.26557 17.5391 9.09277 17.5391C8.92005 17.539 8.7793 17.4014 8.7793 17.2158C8.77938 17.024 8.92011 16.8868 9.09277 16.8867ZM10.874 16.8799C11.0628 16.8799 11.1874 17.0271 11.1875 17.2158C11.1875 17.4046 11.0628 17.5391 10.874 17.5391C10.6917 17.539 10.5605 17.411 10.5605 17.2158C10.5606 17.0176 10.6918 16.88 10.874 16.8799ZM12.7432 16.8867C12.9158 16.8868 13.0566 17.024 13.0566 17.2158C13.0566 17.4013 12.9159 17.5389 12.7432 17.5391C12.5704 17.5391 12.4297 17.4014 12.4297 17.2158C12.4298 17.0239 12.5704 16.8867 12.7432 16.8867ZM16.0527 16.8867C16.2253 16.8869 16.3661 17.0241 16.3662 17.2158C16.3662 17.4013 16.2253 17.5388 16.0527 17.5391C15.8799 17.5391 15.7383 17.4014 15.7383 17.2158C15.7384 17.0239 15.88 16.8867 16.0527 16.8867ZM16.6406 6.73145C16.2164 6.37791 15.585 6.43519 15.2314 6.85938L11.6338 11.1777C11.2873 11.5935 11.0921 11.8233 10.9365 11.9648C10.9347 11.9665 10.9325 11.9681 10.9307 11.9697C10.9287 11.9683 10.9259 11.9673 10.9238 11.9658C10.7561 11.8389 10.541 11.6269 10.1582 11.2441L8.70703 9.79297C8.31651 9.40245 7.68349 9.40245 7.29297 9.79297C6.90245 10.1835 6.90245 10.8165 7.29297 11.207L8.74414 12.6582C9.08528 12.9993 9.41337 13.3313 9.71777 13.5615C10.0043 13.7781 10.3686 13.9835 10.8232 14.0146L11.0234 14.0166L11.2227 13.9961C11.6726 13.9238 12.0165 13.686 12.2822 13.4443C12.5644 13.1876 12.8612 12.8284 13.1699 12.458L16.7686 8.14062C17.1221 7.71638 17.0648 7.08502 16.6406 6.73145Z" fill="currentColor"/>
        </svg>
        <h1 className="login-title">Create Account</h1>
        <div className="login-field">
          <label className="login-label" htmlFor="register-fullname">Full Name</label>
          <input
            id="register-fullname"
            className="login-input"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="login-field">
          <label className="login-label" htmlFor="register-email">Email</label>
          <input
            id="register-email"
            className="login-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="login-field">
          <label className="login-label" htmlFor="register-password">Password</label>
          <input
            id="register-password"
            className="login-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="login-field">
          <label className="login-label" htmlFor="register-password-confirm">Confirm Password</label>
          <input
            id="register-password-confirm"
            className="login-input"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            disabled={loading}
          />
        </div>
        <button className="login-button" type="submit" disabled={loading}>
          {loading ? "Creating Account..." : "Register"}
        </button>
        {error ? <p className="login-error">{error}</p> : null}
        <button
          type="button"
          className="register-link"
          onClick={() => onBackToLogin && onBackToLogin()}
          disabled={loading}
        >
          Already have an account? Login
        </button>
      </form>

      <button
        type="button"
        className="settings-icon-button"
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
      >
        <SettingsIcon />
      </button>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={() => {
          setSettingsOpen(false);
          window.location.reload();
        }}
      />
    </main>
  );
}
