import nodemailer from "nodemailer";
import type { Company, Game, Opportunity, OutreachMessage } from "@prisma/client";
import { getDebugSettings } from "@/lib/operations-settings";
import { isKoreanCompany } from "./korea-exclusion";
import { buildEmailDraft } from "./outreach";

type OpportunityWithContext = Opportunity & {
  company: Company;
  game: Game;
  outreachMessages: OutreachMessage[];
};

type EmailTemplateInput = {
  subjectTemplate?: string;
  bodyTemplate?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getTransporter() {
  const host = requiredEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = requiredEnv("SMTP_USER");
  const pass = requiredEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function canRecordEmailWithoutSmtp() {
  const settings = await getDebugSettings();
  return settings.disableActualEmailSending;
}

export function emailForOpportunity(opportunity: OpportunityWithContext) {
  const existingDraft = opportunity.outreachMessages.find((message) => message.channel === "email");
  if (existingDraft) {
    return {
      subject: existingDraft.subject || buildEmailDraft(opportunity).subject,
      body: existingDraft.body,
      draftId: existingDraft.id
    };
  }

  return { ...buildEmailDraft(opportunity), draftId: null };
}

export function applyOpportunityTemplate(template: string, opportunity: OpportunityWithContext) {
  const companyName = emailSafeCompanyName(opportunity.company.name);
  return template
    .replace(/Dear\s+\[business_name\],/gi, companyName === "there" ? "Hi," : `Dear ${companyName},`)
    .replace(/Dear\s+\[company_name\],/gi, companyName === "there" ? "Hi," : `Dear ${companyName},`)
    .replace(/\[business_name\]\s+Team/gi, companyName === "there" ? "there" : `${companyName} Team`)
    .replace(/\[company_name\]\s+Team/gi, companyName === "there" ? "there" : `${companyName} Team`)
    .replace(/\[business_name\]/gi, companyName)
    .replace(/\[company_name\]/gi, companyName)
    .replace(/\[game_title\]/gi, opportunity.game.title)
    .replace(/\[opportunity_type\]/gi, opportunity.opportunityType.replaceAll("_", " "));
}

export function emailForOpportunityWithTemplate(opportunity: OpportunityWithContext, input: EmailTemplateInput = {}) {
  const fallback = emailForOpportunity(opportunity);
  return {
    subject: input.subjectTemplate ? applyOpportunityTemplate(input.subjectTemplate, opportunity) : fallback.subject,
    body: input.bodyTemplate ? applyOpportunityTemplate(input.bodyTemplate, opportunity) : fallback.body,
    draftId: fallback.draftId
  };
}

function emailSafeCompanyName(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized || normalized === "needs research" || normalized === "not identified" || normalized === "unknown") {
    return "there";
  }
  return name;
}

export async function sendLeadEmail(opportunity: OpportunityWithContext, input: EmailTemplateInput = {}) {
  if (isKoreanCompany(opportunity.company)) {
    throw new Error("Email sending is disabled for Korean companies.");
  }
  const recipient = opportunity.company.contactEmail;
  if (!recipient) throw new Error(`${opportunity.company.name} does not have a contact email`);

  const draft = emailForOpportunityWithTemplate(opportunity, input);
  const debugSettings = await getDebugSettings();

  if (!debugSettings.disableActualEmailSending) {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME;
    const fromAddress = fromName && from ? `"${fromName}" <${from}>` : from;

    await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: draft.subject,
      text: draft.body,
      attachments: input.attachments
    });
  }

  return {
    recipient,
    subject: draft.subject,
    body: draft.body,
    draftId: draft.draftId
  };
}
