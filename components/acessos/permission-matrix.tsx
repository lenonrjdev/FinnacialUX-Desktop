import { CheckIcon, CloseIcon, ShieldIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import { permissionDefinitions } from "@/data/acessos";
import { roleCan } from "@/lib/access-control";
import type { WorkspaceRole } from "@/types/acessos";

const roles: WorkspaceRole[] = ["owner", "editor", "viewer"];

export function PermissionMatrix() {
  return (
    <section className="access-panel permission-panel">
      <header className="access-panel-header">
        <div>
          <h2>{accessContent.permissions.title}</h2>
          <p>{accessContent.permissions.description}</p>
        </div>
        <span className="access-panel-icon"><ShieldIcon /></span>
      </header>
      <div className="permission-table-scroll">
        <table className="permission-table">
          <thead>
            <tr>
              <th>{accessContent.permissions.permission}</th>
              {roles.map((role) => <th key={role}>{accessContent.roles[role]}</th>)}
            </tr>
          </thead>
          <tbody>
            {permissionDefinitions.map((permission) => (
              <tr key={permission.key}>
                <td>
                  <strong>{permission.label}</strong>
                  <span>{permission.description}</span>
                </td>
                {roles.map((role) => {
                  const allowed = roleCan(role, permission.key);
                  return (
                    <td key={role}>
                      <span className={`permission-state ${allowed ? "allowed" : "denied"}`} title={allowed ? accessContent.permissions.allowed : accessContent.permissions.denied}>
                        {allowed ? <CheckIcon /> : <CloseIcon />}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
