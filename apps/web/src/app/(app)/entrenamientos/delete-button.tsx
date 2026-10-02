"use client";

import { deleteWorkoutAction } from "@/lib/actions/workouts";

export function DeleteWorkoutButton({ id }: { id: string }) {
  return (
    <form
      action={deleteWorkoutAction}
      onSubmit={(e) => {
        if (!window.confirm("¿Eliminar este registro? Si estaba asociado al plan, la sesión vuelve a quedar pendiente.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="min-h-11 rounded-lg px-2 text-xs font-semibold text-danger hover:bg-danger-bg">Eliminar</button>
    </form>
  );
}
