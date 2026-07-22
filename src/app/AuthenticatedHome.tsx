import React from "react";
import Wizard from "@/components/wizard/Wizard";
import LogoutButton from "@/components/auth/LogoutButton";

export default function AuthenticatedHome() {
  return (
    <>
      <div className="mx-auto flex max-w-5xl justify-end px-4 pt-4">
        <LogoutButton />
      </div>
      <Wizard />
    </>
  );
}
