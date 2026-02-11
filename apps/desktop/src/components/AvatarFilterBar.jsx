function initials(name) {
  if (name === "ALL") {
    return "ALL";
  }

  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function AvatarFilterBar({ options, active, onChange, loggedInUserId, onlineUsers = [], isConnected, isIdle }) {
  function getPresenceClass(optionId) {
    if (optionId === "all") {
      return "";
    }
    if (optionId === loggedInUserId) {
      if (!isConnected) return "offline";
      return isIdle ? "idle" : "online";
    }
    // Diğer kullanıcılar: online_users listesinde varsa online
    return onlineUsers.includes(optionId) ? "online" : "offline";
  }

  return (
    <div className="avatar-bar">
      {options.map((option) => {
        const presenceClass = getPresenceClass(option.id);
        const nonMemberClass = option.isWorkspaceMember === false ? "non-member" : "";
        return (
          <button
            key={option.id}
            className={`avatar-pill ${active === option.id ? "active" : ""} ${presenceClass} ${nonMemberClass}`}
            onClick={() => onChange(option.id)}
            type="button"
            title={option.label}
          >
            {option.avatar_base64 ? (
              <img
                src={option.avatar_base64}
                alt={option.label}
                className="avatar-pill-img"
              />
            ) : (
              initials(option.label)
            )}
          </button>
        );
      })}
    </div>
  );
}
