/**
 * Promueve un usuario existente al rol `developer` (máximo nivel).
 *
 * Uso:
 *   pnpm promote:developer juampiacosta158@gmail.com
 *   (o)  tsx scripts/promote-to-developer.ts <email>
 *
 * Reglas:
 * - El usuario tiene que existir previamente en auth.users (loguearse
 *   al menos una vez con su email).
 * - Service role bypassa RLS, así que no hace falta autenticarse acá.
 * - Idempotente: si ya está como developer, no rompe.
 * - Por seguridad: hay un solo developer en el sistema. Si ya existe
 *   OTRO developer, este script avisa y NO procede salvo --force.
 */

import { getServiceClient } from "./_lib"

const db = getServiceClient()

async function main() {
  const argv = process.argv.slice(2)
  const force = argv.includes("--force")
  const email = argv.find(a => !a.startsWith("--"))?.trim().toLowerCase()

  if (!email) {
    console.error("✗ Falta email. Uso: tsx scripts/promote-to-developer.ts <email> [--force]")
    process.exit(1)
  }

  console.log(`Buscando usuario ${email}...`)

  // 1) Localizar el auth user.
  const { data, error } = await db.auth.admin.listUsers({ perPage: 200 })
  if (error) {
    console.error("✗ No pude listar auth.users:", error.message)
    process.exit(1)
  }
  const targetUser = (data?.users ?? []).find(u => u.email?.toLowerCase() === email)
  if (!targetUser) {
    console.error(`✗ No existe ningún auth user con email ${email}.`)
    console.error("  Asegurate de que el usuario haya hecho signup primero.")
    process.exit(1)
  }

  // 2) Chequear si ya hay un developer.
  const { data: existingDevs } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("role", "developer")

  const otherDevs = (existingDevs ?? []).filter(d => d.id !== targetUser.id)
  if (otherDevs.length > 0 && !force) {
    console.error(`✗ Ya existe ${otherDevs.length} developer(s) en el sistema:`)
    for (const d of otherDevs) {
      console.error(`    - ${d.id} (${d.full_name ?? "(sin nombre)"})`)
    }
    console.error("\n  Solo se espera UN developer. Si igual querés agregar otro:")
    console.error("    tsx scripts/promote-to-developer.ts <email> --force")
    console.error("\n  Para demotar al anterior antes:")
    console.error("    update public.profiles set role='admin' where role='developer';")
    process.exit(1)
  }

  // 3) Asegurar que existe profile (el trigger lo crea en signup, pero por
  //    si se borró manualmente, lo upserteamos con role=developer).
  //    Solo seteamos `role` — el resto de los campos (status, position,
  //    department_id, etc.) los maneja el usuario por la UI.
  const { error: upsertErr } = await db
    .from("profiles")
    .upsert(
      { id: targetUser.id, role: "developer" },
      { onConflict: "id" }
    )

  if (upsertErr) {
    console.error("✗ Error promoviendo:", upsertErr.message)
    process.exit(1)
  }

  console.log("")
  console.log(`✓ ${email} promovido a developer.`)
  console.log(`  Auth user ID: ${targetUser.id}`)
  console.log("")
  console.log("  Recordá:")
  console.log("  - developer pasa todos los gates de admin/super_admin.")
  console.log("  - El badge \"Developer\" aparece en el top-bar y /admin/team.")
  console.log("  - Para demotar: update public.profiles set role='admin' where id=...")
}

main().catch(e => {
  console.error("✗ Error fatal:", e)
  process.exit(1)
})
