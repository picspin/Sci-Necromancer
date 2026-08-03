const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[A-Za-z0-9_-]{20,}\b/,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}\b/,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~-]{16,}\b/i,
];

const PATIENT_IDENTIFIER_PATTERNS = [
  /\b(?:MRN|medical record number|patient(?:\s+id|\s+identifier))\s*[:#-]?\s*[A-Za-z0-9-]{4,}\b/i,
  /(?:病历号|住院号|患者编号|患者ID)\s*[:：#-]?\s*[A-Za-z0-9-]{4,}/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\d .()-]{7,}\d)\b/,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (?:all |the )?(?:previous|prior|system) instructions?/i,
  /reveal (?:the |your )?(?:system prompt|hidden instructions?)/i,
  /developer message/i,
  /jailbreak/i,
  /忽略(?:之前|以上|系统).{0,12}(?:指令|提示)/,
  /(?:泄露|显示).{0,12}(?:系统提示|隐藏指令)/,
];

const HIDDEN_CHARACTER_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/;
const HTML_TAG_PATTERN = /<\/?[A-Za-z][^>]*>/;
const EXTERNAL_URL_PATTERN = /\bhttps?:\/\/[^\s]+/i;

export type HelpQuestionValidationError =
  | 'help_question_required'
  | 'help_question_too_long'
  | 'help_sensitive_content'
  | 'help_patient_identifier'
  | 'help_prompt_injection'
  | 'help_unsafe_markup'
  | 'help_external_url'
  | 'help_hidden_characters';

export function validateHelpQuestion(question: unknown): HelpQuestionValidationError | null {
  if (typeof question !== 'string' || !question.trim()) return 'help_question_required';
  if (question.length > 1_000) return 'help_question_too_long';
  if (HIDDEN_CHARACTER_PATTERN.test(question)) return 'help_hidden_characters';
  if (HTML_TAG_PATTERN.test(question)) return 'help_unsafe_markup';
  if (EXTERNAL_URL_PATTERN.test(question)) return 'help_external_url';
  if (SECRET_PATTERNS.some((pattern) => pattern.test(question))) return 'help_sensitive_content';
  if (PATIENT_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(question))) {
    return 'help_patient_identifier';
  }
  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(question))) {
    return 'help_prompt_injection';
  }
  return null;
}
