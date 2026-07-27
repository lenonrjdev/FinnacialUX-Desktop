import { ApiError } from "@/lib/api/client";
import { desktopAuth } from "@/lib/desktop/auth";
import type { ApiMessage } from "@/types/api";

export const authApi = {
  me: () => desktopAuth.me(),
  login: (email: string, password: string, remember: boolean) =>
    desktopAuth.login(email, password, remember),
  register: (name: string, email: string, password: string) =>
    desktopAuth.register(name, email, password),
  logout: () => desktopAuth.logout(),
  forgotPassword: (email: string) => desktopAuth.forgotPassword(email),
  resetPassword: (token: string, password: string) => desktopAuth.resetPassword(token, password),
  acceptInvitation: async (_token: string): Promise<ApiMessage & { workspaceId: string }> => {
    throw new ApiError(
      "Convites compartilhados pertencem ao FinnacialUX Core e não estão disponíveis no modo Desktop offline.",
      501,
    );
  },
};
