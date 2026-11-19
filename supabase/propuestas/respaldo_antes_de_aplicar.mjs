// Respaldo VERIFICABLE y de SOLO LECTURA de lo que toca (y de lo que no debe tocar) la migración 20261209100000.
// Uso:  node supabase/propuestas/respaldo_antes_de_aplicar.mjs [carpeta_destino]
// Cada consulta corre con `supabase db query --remote --read-only` (transacción de solo lectura: no puede escribir).
// Guarda una tabla por archivo JSON, las definiciones actuales de las funciones que se reemplazan (para revertir), y un manifest.json con
// filas y sha256 de cada archivo. Después vuelve a contar cada tabla en la base y compara: si algo no coincide, termina con error.
// Los archivos contienen datos de estudiantes: guárdalos fuera del repositorio.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sello = new Date().toISOString().replace(/[:.]/g, '-')
const destino = process.argv[2] ?? join(process.cwd(), '..', 'universa-respaldos', sello)
mkdirSync(destino, { recursive: true })

// El SQL viaja en un archivo temporal (--file) para que el shell de Windows no lo parta en argumentos.
const tmp = mkdtempSync(join(tmpdir(), 'respaldo-'))
function consulta(sql) {
  const archivo = join(tmp, 'q.sql')
  writeFileSync(archivo, sql)
  let salida
  try {
    salida = execFileSync('npx', ['supabase', 'db', 'query', '--remote', '--read-only', '--file', `"${archivo}"`], { encoding: 'utf8', shell: true, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    throw new Error(`La consulta falló: ${String(e.stdout ?? '').slice(0, 300)}`)
  }
  const ini = salida.indexOf('{')
  const json = JSON.parse(salida.slice(ini, salida.lastIndexOf('}') + 1))
  if (!Array.isArray(json.rows)) throw new Error('Respuesta inesperada de la base')
  return json.rows
}

const tablas = [
  'eval_rubricas', 'eval_rubrica_criterios', 'eval_calificaciones', 'eval_historial', 'eval_componentes', 'eval_versiones',
  'eval_plantillas', 'eval_evaluaciones', 'eval_modulos', 'eval_formative_vinculos', 'ejercicio_entregas', 'ciclos', 'niveles',
]
const funciones = ['eval_nota_exacta', 'eval_resolver_nota', 'calificar_entrega_rubrica', 'guardar_rubrica', 'eval_evaluacion_detalle']

const manifest = { creado: new Date().toISOString(), destino, tablas: {}, funciones: {} }
const sha = (t) => createHash('sha256').update(t).digest('hex')

for (const t of tablas) {
  const filas = consulta(`select * from public.${t} order by 1`)
  const texto = JSON.stringify(filas, null, 1)
  writeFileSync(join(destino, `${t}.json`), texto)
  manifest.tablas[t] = { filas: filas.length, sha256: sha(texto) }
  console.log(`${t}: ${filas.length} filas`)
}
for (const f of funciones) {
  const filas = consulta(`select p.oid::regprocedure::text as firma, pg_get_functiondef(p.oid) as definicion from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '${f}'`)
  const texto = filas.map((r) => `-- ${r.firma}\n${r.definicion};\n`).join('\n')
  writeFileSync(join(destino, `funcion_${f}.sql`), texto)
  manifest.funciones[f] = { definiciones: filas.length, sha256: sha(texto) }
  console.log(`funcion ${f}: ${filas.length} definición(es)`)
}
writeFileSync(join(destino, 'manifest.json'), JSON.stringify(manifest, null, 2))

// Verificación: los archivos en disco coinciden con su sha256 y la base sigue teniendo las mismas filas.
let errores = 0
for (const t of tablas) {
  const enDisco = readFileSync(join(destino, `${t}.json`), 'utf8')
  if (sha(enDisco) !== manifest.tablas[t].sha256) { console.error(`✗ ${t}: el archivo no coincide con su sha256`); errores++ }
  const n = Number(consulta(`select count(*)::int as n from public.${t}`)[0].n)
  if (n !== manifest.tablas[t].filas) { console.error(`✗ ${t}: respaldadas ${manifest.tablas[t].filas}, la base tiene ${n} (¿cambió durante el respaldo?)`); errores++ }
}
for (const f of funciones) {
  if (manifest.funciones[f].definiciones === 0) { console.error(`✗ función ${f}: no se encontró`); errores++ }
}
rmSync(tmp, { recursive: true, force: true })
if (errores) { console.error(`\nRESPALDO NO VÁLIDO (${errores} problema(s)). No apliques la migración.`); process.exit(1) }
console.log(`\nRESPALDO VÁLIDO en ${destino}\nGuarda el manifest.json: sirve para comprobar que nada cambió después de aplicar.`)
