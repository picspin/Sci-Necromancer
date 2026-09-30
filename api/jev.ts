import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '../backend/_types/vercel.js';
import { createJevMemberPolicy } from '../backend/_jev/memberPolicy.js';
import { createJevGenerationWorkflow } from '../backend/_jev/generationWorkflow.js';
import { createJevVersionStore } from '../backend/_jev/versionStore.js';
import { handleFigureRoute } from '../backend/_jev/figureRouteHandler.js';
import {
  buildJevAnalysisRequest,
  requestTypesafeJev,
  sanitizeJevAnalysisInput,
  TypesafeJevError,
  type JevAnalysisInput,
} from '../backend/_jev/typesafe.js';
import { prepareMemberApi, sendApiError } from '../backend/_member/http.js';
import { MemberServiceError } from '../backend/_member/memberService.js';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from '../backend/_member/supabaseServer.js';

type Candidate = { name: string; type: 'main' | 'sub' | 'secondary' };
type SupportedConference = 'ISMRM' | 'RSNA' | 'ER' | 'ASCO' | 'ESMO' | 'JACC';
type CandidateSet = { categories: Candidate[]; keywords: string[] };

// Server-owned candidates prevent callers from redefining the Jev question set.
const CANDIDATES: Record<SupportedConference, CandidateSet> = {
  ISMRM: {
    categories: [
      ['Acquisition Methods', 'main'],
      ['Image Reconstruction', 'main'],
      ['Contrast Mechanisms', 'main'],
      ['Neuro', 'sub'],
      ['Body', 'sub'],
      ['Cardiovascular', 'sub'],
      ['Musculoskeletal', 'sub'],
      ['Pediatric', 'secondary'],
      ['Interventional', 'secondary'],
    ].map(([name, type]) => ({ name, type: type as Candidate['type'] })),
    keywords: [
      'MRI',
      'fMRI',
      'DTI',
      'ASL',
      'BOLD',
      'T1',
      'T2',
      'FLAIR',
      'Gradient Echo',
      'Spin Echo',
      'EPI',
      'Parallel Imaging',
      'Compressed Sensing',
      'Machine Learning',
      'Deep Learning',
      'Reconstruction',
      'Artifact Reduction',
      'Motion Correction',
      'Quantitative Imaging',
      'Biomarkers',
    ],
  },
  RSNA: {
    categories: [
      'Abdominal Imaging',
      'Breast Imaging',
      'Cardiac Imaging',
      'Chest Imaging',
      'Emergency Radiology',
      'Gastrointestinal Imaging',
      'Genitourinary Imaging',
      'Head and Neck Imaging',
      'Interventional Radiology',
      'Molecular Imaging',
      'Musculoskeletal Imaging',
      'Neuroradiology',
      'Nuclear Medicine',
      'Pediatric Imaging',
      'Physics',
      'Radiation Oncology',
      'Vascular and Interventional',
      "Women's Imaging",
    ].map((name) => ({ name, type: 'main' })),
    keywords: [
      'CT',
      'MRI',
      'Ultrasound',
      'X-ray',
      'Mammography',
      'Tomosynthesis',
      'PET/CT',
      'SPECT',
      'Artificial Intelligence/Machine Learning',
      'Computer-aided Detection/Diagnosis',
      'Contrast Agents',
      'Perfusion',
      'Diffusion',
      'Diagnosis',
      'Biopsy',
      'CT Angiography',
      'Echocardiography',
      'Coronary Artery Disease',
      'Lung Cancer',
      'Thoracic CT',
      'Pulmonary',
      'Pneumonia',
      'Trauma',
      'Workflow',
      'Triage',
      'Inflammatory Bowel Disease',
      'Liver Disease',
      'Renal Masses',
      'Stroke',
      'Radiomics',
    ],
  },
  ER: {
    categories: [
      ['Emergency Radiology', 'main'],
      ['Abdominal Imaging', 'sub'],
      ['Cardiothoracic Imaging', 'sub'],
      ['Neuroradiology', 'sub'],
      ['Musculoskeletal Imaging', 'sub'],
      ['Trauma Imaging', 'secondary'],
      ['Artificial Intelligence', 'secondary'],
      ['Patient Safety', 'secondary'],
    ].map(([name, type]) => ({ name, type: type as Candidate['type'] })),
    keywords: [
      'CT',
      'MRI',
      'Ultrasound',
      'Trauma',
      'Stroke',
      'Pulmonary Embolism',
      'Acute Abdomen',
      'Emergency Department',
      'Diagnostic Accuracy',
      'Radiomics',
      'Artificial Intelligence',
      'Machine Learning',
      'Workflow',
      'Patient Safety',
      'Triage',
    ],
  },
  ASCO: {
    categories: [
      'Breast Cancer',
      'Central Nervous System Tumors',
      'Developmental Therapeutics',
      'Gastrointestinal Cancer—Colorectal and Anal',
      'Gastrointestinal Cancer—Gastroesophageal, Pancreatic, and Hepatobiliary',
      'Genitourinary Cancer—Kidney and Bladder',
      'Genitourinary Cancer—Prostate, Testicular, and Penile',
      'Gynecologic Cancer',
      'Head and Neck Cancer',
      'Health Services Research and Quality Improvement',
      'Hematologic Malignancies',
      'Lung Cancer—Non-Small Cell',
      'Lung Cancer—Small Cell/Other Thoracic Cancers',
      'Melanoma/Skin Cancers',
      'Pediatric Oncology',
      'Prevention, Risk Reduction, and Genetics',
      'Sarcoma',
      'Symptoms and Survivorship',
    ].map((name) => ({ name, type: 'main' })),
    keywords: [
      'Clinical Trial',
      'Biomarker',
      'Immunotherapy',
      'Targeted Therapy',
      'Overall Survival',
      'Progression-Free Survival',
      'Real-World Evidence',
      'Quality of Life',
      'Screening',
      'Precision Oncology',
    ],
  },
  ESMO: {
    categories: [
      'AI for diagnostics and profiling',
      'AI for clinical workflows and decision-making',
      'AI for clinical research and drug development',
      'Basic science',
      'New diagnostic tools',
      'Pathology and molecular pathology',
      'Translational research and biomarkers',
      'Breast cancer, early stage',
      'Advanced breast cancer, other',
      'CNS tumours',
      'Developmental therapeutics',
      'Hepatocellular carcinoma',
      'Pancreatic cancer',
      'Colon cancer',
      'Renal cancer',
      'Gynaecological cancers',
      'Haematological malignancies',
      'Investigational immunotherapy',
      'Melanoma',
      'Lung cancer',
      'Palliative care',
      'Supportive care',
      'Miscellaneous',
    ].map((name) => ({ name, type: 'main' })),
    keywords: [
      'Clinical Trial',
      'Translational Research',
      'Biomarker',
      'Immunotherapy',
      'Molecular Profiling',
      'Real-World Data',
      'Patient-Reported Outcomes',
      'Artificial Intelligence',
      'Supportive Care',
      'Precision Medicine',
    ],
  },
  JACC: {
    categories: [
      ['Clinical Cardiology', 'main'],
      ['Interventional Cardiology', 'main'],
      ['Electrophysiology', 'sub'],
      ['Heart Failure', 'sub'],
      ['Imaging', 'sub'],
      ['Prevention', 'secondary'],
      ['Cardiovascular Outcomes', 'secondary'],
    ].map(([name, type]) => ({ name, type: type as Candidate['type'] })),
    keywords: [
      'Cardiovascular Disease',
      'Heart Failure',
      'Coronary Artery Disease',
      'Atrial Fibrillation',
      'Echocardiography',
      'Cardiac MRI',
      'Clinical Trial',
      'Outcomes',
      'Biomarker',
      'Prevention',
    ],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalDigest(input: JevAnalysisInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({ policyVersion: 'jev-analysis-v1', request: buildJevAnalysisRequest(input) })
    )
    .digest('hex');
}

function candidatesFor(value: unknown): CandidateSet {
  if (typeof value !== 'string' || !(value in CANDIDATES))
    throw new TypesafeJevError('unsupported_jev_conference', 400);
  return CANDIDATES[value as SupportedConference];
}

function providerError(error: unknown): { error: string } {
  return error instanceof TypesafeJevError
    ? { error: error.code }
    : { error: 'typesafe_jev_failed' };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method === 'POST' && request.body?.action === 'figure-route')
    return handleFigureRoute(request, response);
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  const versionsRequest = request.method === 'GET' && request.query?.action === 'versions';
  if (!versionsRequest && process.env.TYPESAFE_JEV_ENABLED !== 'true')
    return response.status(404).json({ error: 'typesafe_jev_disabled' });
  if (request.method !== 'GET' && request.method !== 'POST')
    return response.status(405).json({ error: 'method_not_allowed' });

  try {
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    const memberClient = createScopedMemberRpcClient(admin, user.id);
    if (versionsRequest) {
      const rawLimit = request.query?.limit;
      const limit = rawLimit === undefined ? 10 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10)
        throw new MemberServiceError('invalid_jev_generation_version_query', 400);
      return response.status(200).json({
        versions: await createJevVersionStore(memberClient).listVersions(user.id, limit),
      });
    }
    const policy = createJevMemberPolicy(memberClient);
    if (request.method === 'GET') return response.status(200).json(await policy.getConsent());

    const body = isRecord(request.body) ? request.body : {};
    const action = body.action ?? (typeof body.text === 'string' ? 'analyze' : undefined);
    if (action === 'consent') {
      if (typeof body.accepted !== 'boolean')
        return response.status(400).json({ error: 'invalid_jev_consent' });
      await policy.setConsent(body.accepted);
      return response.status(200).json(await policy.getConsent());
    }
    if (action !== 'analyze') return response.status(400).json({ error: 'invalid_jev_action' });

    const candidates = candidatesFor(body.conference);
    const input = sanitizeJevAnalysisInput({
      text: body.text,
      conference: body.conference,
      ...candidates,
    });
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || !idempotencyKey || idempotencyKey.length > 128)
      throw new MemberServiceError('invalid_jev_workflow_request', 400);
    if (body.model !== 'glm-5.2' && body.model !== 'gpt-5.6-luna')
      throw new MemberServiceError('invalid_jev_workflow_request', 400);
    const cacheKey = canonicalDigest(input);
    const openWorkflow = () =>
      createJevGenerationWorkflow(memberClient).open(idempotencyKey, cacheKey, {
        sourceHash: createHash('sha256').update(input.text, 'utf8').digest('hex'),
        conference: input.conference,
        model: body.model as string,
      });
    const reservation = await policy.reserve(cacheKey);
    if (reservation.kind === 'cached') {
      const workflow = await openWorkflow();
      return response.status(200).json({
        ...reservation.result,
        ...workflow,
        cached: true,
        remaining: reservation.remaining,
      });
    }
    if (reservation.kind === 'pending')
      return response
        .status(202)
        .json({ error: 'jev_analysis_pending', remaining: reservation.remaining });
    if (reservation.kind === 'limited') {
      response.setHeader(
        'Retry-After',
        Math.max(1, Math.ceil((Date.parse(reservation.retryAt) - Date.now()) / 1000))
      );
      return response.status(429).json({
        error: 'jev_analysis_rate_limited',
        retryAt: reservation.retryAt,
        remaining: reservation.remaining,
      });
    }

    let result;
    try {
      result = await requestTypesafeJev(input);
      await policy.settle(reservation.reservationId, true, { ...result });
    } catch (error) {
      try {
        await policy.settle(reservation.reservationId, false);
      } catch {
        /* preserve sanitized provider error */
      }
      return response
        .status(error instanceof TypesafeJevError ? error.status : 503)
        .json(providerError(error));
    }
    const workflow = await openWorkflow();
    return response
      .status(200)
      .json({ ...result, ...workflow, cached: false, remaining: reservation.remaining });
  } catch (error) {
    if (error instanceof TypesafeJevError)
      return response.status(error.status).json(providerError(error));
    return sendApiError(response, error);
  }
}

export const config = { maxDuration: 20 };
