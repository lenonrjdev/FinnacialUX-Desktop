import { EditIcon, SearchIcon, TrashIcon, UsersIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import { formatAccessDate, formatAccessDateTime } from "@/lib/access-control";
import type { WorkspaceMember } from "@/types/acessos";

export function MembersPanel({
  members,
  query,
  canManage,
  onQueryChange,
  onEdit,
  onRemove,
}: {
  members: WorkspaceMember[];
  query: string;
  canManage: boolean;
  onQueryChange: (value: string) => void;
  onEdit: (member: WorkspaceMember) => void;
  onRemove: (member: WorkspaceMember) => void;
}) {
  return (
    <section className="access-panel members-panel">
      <header className="access-panel-header members-panel-header">
        <div>
          <h2>{accessContent.members.title}</h2>
          <p>{accessContent.members.description}</p>
        </div>
        <label className="access-search-field">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={accessContent.members.searchPlaceholder}
          />
        </label>
      </header>

      <div className="members-table-scroll">
        <table className="members-table">
          <thead>
            <tr>
              <th>{accessContent.members.name}</th>
              <th>{accessContent.members.role}</th>
              <th>{accessContent.members.joinedAt}</th>
              <th>{accessContent.members.lastAccess}</th>
              <th>{accessContent.members.actions}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <span className="member-avatar">{member.initials}</span>
                  <div>
                    <strong>{member.name} {member.isCurrentUser ? <small>{accessContent.members.you}</small> : null}</strong>
                    <span>{member.email}</span>
                  </div>
                </td>
                <td><span className={`role-badge ${member.role}`}>{accessContent.roles[member.role]}</span></td>
                <td>{formatAccessDate(member.joinedAt)}</td>
                <td>{formatAccessDateTime(member.lastAccessAt)}</td>
                <td>
                  <div className="member-actions">
                    <button
                      type="button"
                      disabled={!canManage || member.role === "owner" || member.isCurrentUser}
                      onClick={() => onEdit(member)}
                      aria-label={accessContent.members.changeRole}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="danger"
                      type="button"
                      disabled={!canManage || member.role === "owner" || member.isCurrentUser}
                      onClick={() => onRemove(member)}
                      aria-label={member.role === "owner" ? accessContent.members.ownerProtected : accessContent.members.remove}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!members.length ? <div className="access-empty-state"><UsersIcon /> {accessContent.members.noResults}</div> : null}
    </section>
  );
}
