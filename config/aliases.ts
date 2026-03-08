import path from "path";

export const alias = {
  "@": path.resolve(process.cwd(), "client/src"),
  "@server": path.resolve(process.cwd(), "server"),
};
