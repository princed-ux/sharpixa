import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Responsible Use Policy",

  description:
    "Understand the lawful and responsible uses of Sharpixa's object removal, background removal, and media-improvement tools.",

  alternates: {
    canonical: "/responsible-use/",
  },

  openGraph: {
    type: "website",
    url: "/responsible-use/",
    title: "Responsible Use Policy | Sharpixa",
    description:
      "Rules and practical examples for lawful use of Sharpixa's media-editing tools.",
    siteName: "Sharpixa",
  },
};

const SECTIONS = [
  {
    id: "purpose",
    title: "Purpose",
  },
  {
    id: "ownership",
    title: "Ownership and Permission",
  },
  {
    id: "watermarks",
    title: "Watermarks and Attribution",
  },
  {
    id: "documents",
    title: "Documents and Evidence",
  },
  {
    id: "privacy",
    title: "Privacy and Consent",
  },
  {
    id: "deception",
    title: "Deception and Impersonation",
  },
  {
    id: "acceptable-examples",
    title: "Acceptable Examples",
  },
  {
    id: "prohibited-examples",
    title: "Prohibited Examples",
  },
  {
    id: "enforcement",
    title: "Enforcement",
  },
  {
    id: "reporting",
    title: "Reporting Misuse",
  },
];

export default function ResponsibleUsePage() {
  return (
    <InfoPage
      eyebrow="Lawful and ethical editing"
      title="Responsible Use Policy"
      description="Sharpixa is intended for legitimate media editing—not for removing ownership information, falsifying records, deceiving viewers, or violating another person's rights."
      icon="shield"
      lastUpdated="August 2, 2026"
      sections={SECTIONS}
      notice={
        <p>
          Having technical access to an editing feature does not give you legal
          permission to modify or redistribute a file.
        </p>
      }
    >
      <section>
        <h2 id="purpose">
          1. Purpose
        </h2>

        <p>
          This policy explains how Sharpixa’s object removal, text removal,
          background removal, and media-improvement tools should be used.
        </p>

        <p>
          It supplements the{" "}
          <a href="/terms/">
            Terms of Use
          </a>{" "}
          and applies to every person using Sharpixa.
        </p>
      </section>

      <section>
        <h2 id="ownership">
          2. Ownership and Permission
        </h2>

        <p>
          Process a file only when at least one of the following is true:
        </p>

        <ul>
          <li>You created and own the file.</li>
          <li>The owner gave you clear permission to modify it.</li>
          <li>
            A valid licence expressly permits the intended editing and use.
          </li>
          <li>
            Applicable law clearly permits the specific use and you understand
            the relevant conditions.
          </li>
        </ul>

        <p>
          Public availability does not automatically mean that an image or
          video is free to edit, remove attribution from, or republish.
        </p>
      </section>

      <section>
        <h2 id="watermarks">
          3. Watermarks, Logos, and Attribution
        </h2>

        <p>
          Removing a watermark can be legitimate when:
        </p>

        <ul>
          <li>You added the watermark to your own original file.</li>
          <li>You possess the unwatermarked rights and lost the original copy.</li>
          <li>The owner authorized removal.</li>
          <li>
            A licensor supplied explicit permission for an unmarked version.
          </li>
        </ul>

        <p>
          Do not remove copyright notices, photographer marks, platform marks,
          stock-media watermarks, ownership labels, credits, or attribution
          from protected material without authorization.
        </p>

        <p>
          Sharpixa does not determine whether your particular use is lawful.
          You are responsible for obtaining permission and preserving proof of
          that permission where appropriate.
        </p>
      </section>

      <section>
        <h2 id="documents">
          4. Documents, Records, and Evidence
        </h2>

        <p>
          Sharpixa must not be used to falsify, alter deceptively, or conceal
          material information in:
        </p>

        <ul>
          <li>Bank statements or financial records.</li>
          <li>Receipts, invoices, payslips, or transaction records.</li>
          <li>Identity documents, licences, permits, or certificates.</li>
          <li>Academic records, employment records, or medical documents.</li>
          <li>Contracts, legal notices, court records, or official letters.</li>
          <li>Evidence relating to an investigation, dispute, or insurance claim.</li>
        </ul>

        <p>
          Cosmetic cleanup of a scan must not change dates, amounts, names,
          signatures, account details, obligations, approval status, or any
          other substantive information.
        </p>
      </section>

      <section>
        <h2 id="privacy">
          5. Privacy, Dignity, and Consent
        </h2>

        <p>
          Do not process or distribute intimate, private, confidential, or
          sensitive media without the permission of the people concerned.
        </p>

        <p>
          Do not remove privacy indicators, safety warnings, identifying marks,
          or contextual information in a way that exposes a person to harm,
          harassment, discrimination, or unwanted attention.
        </p>

        <p>
          When editing a recognizable person, consider whether the final image
          could misrepresent their actions, location, appearance, endorsement,
          or circumstances.
        </p>
      </section>

      <section>
        <h2 id="deception">
          6. Deception, Fraud, and Impersonation
        </h2>

        <p>
          Do not use Sharpixa to:
        </p>

        <ul>
          <li>Impersonate another person or organization.</li>
          <li>Create false proof of a payment, event, product, or transaction.</li>
          <li>
            Make it appear that someone endorsed a product, service, cause, or
            statement when they did not.
          </li>
          <li>
            Conceal defects or material facts in a commercial listing.
          </li>
          <li>
            Mislead viewers about the origin, authenticity, date, location, or
            context of media.
          </li>
          <li>
            Facilitate scams, blackmail, harassment, defamation, or fraudulent
            claims.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="acceptable-examples">
          7. Examples of Generally Acceptable Use
        </h2>

        <ul>
          <li>
            Removing a stranger or temporary object from your own travel
            photograph.
          </li>
          <li>
            Cleaning dust, a date stamp, or a scanner mark from your own family
            photograph.
          </li>
          <li>
            Removing your own business logo from a source image you created.
          </li>
          <li>
            Creating a transparent background for a product photograph that
            you own.
          </li>
          <li>
            Resizing and improving your own social-media or website image.
          </li>
          <li>
            Editing client media under a contract that authorizes the requested
            work.
          </li>
          <li>
            Removing an overlay from licensed content when the licence permits
            it.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="prohibited-examples">
          8. Examples of Prohibited Use
        </h2>

        <ul>
          <li>
            Removing a stock-image watermark to avoid purchasing a licence.
          </li>
          <li>
            Changing a date, amount, name, or transaction on a bank statement.
          </li>
          <li>
            Removing a photographer’s credit before republishing their work.
          </li>
          <li>
            Altering evidence or official records to influence a decision.
          </li>
          <li>
            Removing a safety label or product defect from a sales image.
          </li>
          <li>
            Editing a person into a deceptive advertisement or endorsement.
          </li>
          <li>
            Removing context from news or documentary media to mislead viewers.
          </li>
          <li>
            Processing intimate or private media without permission.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="enforcement">
          9. Enforcement
        </h2>

        <p>
          Sharpixa may restrict access, change functionality, investigate
          reports, preserve relevant records, or cooperate with lawful requests
          when necessary to address abuse, security threats, legal obligations,
          or violations of these policies.
        </p>

        <p>
          Sharpixa may also decline to assist with a use that appears intended
          to facilitate fraud, document falsification, infringement, or harm.
        </p>
      </section>

      <section>
        <h2 id="reporting">
          10. Reporting Misuse
        </h2>

        <p>
          Suspected misuse directly involving Sharpixa can be reported through
          the{" "}
          <a href="/contact/">
            Contact page
          </a>
          .
        </p>

        <p>
          Include the relevant page, date, description, and supporting
          information. Do not violate another person’s privacy or gain
          unauthorized access while collecting evidence for a report.
        </p>
      </section>
    </InfoPage>
  );
}