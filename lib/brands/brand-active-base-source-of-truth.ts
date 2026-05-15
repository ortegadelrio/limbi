/**
 * Fuente de verdad de marca para IA y módulos operativos (Brainstormer, proyecto anclado a marca,
 * generación futura ligada a marca).
 *
 * **Regla de producto:** solo `brand_knowledge_bases` y `brand_limbic_bases` **activas y vigentes**
 * (`consolidated_payload` profundo). No usar como fuente principal: respuestas crudas del cuestionario,
 * documentos sin consolidar, facts pendientes, chats de mejora, sesiones de Brainstormer, ni el
 * resumen visible de `/bases` (lectura ejecutiva / UI).
 *
 * @see `loadActiveBrandContextForProject` — carga única permitida para payloads profundos.
 */

/** Pie de página en dashboard de marca (humano vs IA). */
export const BRAND_IA_SOURCE_FOOTNOTE_ES =
  "La IA y los módulos que consumen marca leen el JSON consolidado completo de la Base de Conocimiento y la Base Límbica activas. Lo que ves en «Ver Base de Marca» es una lectura ejecutiva para personas; no sustituye ese payload ni debe usarse solo como contexto de modelo.";

/** Aviso estándar antes de iniciar Brainstormer si hay desalineación no crítica. */
export const BRAND_PENDING_INCORPORATION_BRAINSTORMER_ES =
  "Hay información nueva o pendiente que todavía no ha sido incorporada a la Base de Marca activa. Puedes actualizar la marca antes de brainstormear o continuar usando la versión actual.";
