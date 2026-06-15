import { useStore } from "@nanostores/react";
import { registrationOpen } from "../../lib/auth";

export default function HomeRegisterBtn() {
  const canRegister = useStore(registrationOpen);
  if (canRegister === false) return null;
  return (
    <a href="/register" className="btn-primary shrink-0">
      Crear cuenta
    </a>
  );
}
