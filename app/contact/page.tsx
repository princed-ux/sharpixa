import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

const CONTACT_EMAIL = "contact@sharpixa.com";

export const metadata: Metadata = {
  title: "Contact Sharpixa",

  description:
    "Contact Sharpixa for technical support, privacy questions, copyright concerns, responsible-use reports, and general feedback.",

  alternates: {
    canonical: "/contact/",
  },

  openGraph: {
    type: "website",
    url: "/contact/",
    title: "Contact Sharpixa",
    description:
      "Get in touch with Sharpixa about support, privacy, copyright, abuse reports, or general feedback.",
    siteName: "Sharpixa",
  },
};

const SECTIONS = [
  {
    id: "contact-method",
    title: "Contact Method",
  },
  {
    id: "technical-support",
    title: "Technical Support",
  },
  {
    id: "copyright-reports",
    title: "Copyright Reports",
  },
  {
    id: "privacy-requests",
    title: "Privacy Requests",
  },
  {
    id: "responsible-use-reports",
    title: "Abuse Reports",
  },
  {
    id: "response-information",
    title: "Response Information",
  },
];

export default function ContactPage() {
  return (
    <InfoPage
      eyebrow="Support and enquiries"
      title="Contact Sharpixa"
      description="Use the contact information below for technical support, privacy questions, copyright concerns, responsible-use reports, or general feedback."
      icon="sliders"
      sections={SECTIONS}
      notice={
        <p>
          Do not email private identity documents, passwords, financial
          information, or confidential source media. Include only the
          information needed to understand your request.
        </p>
      }
    >
      <section>
        <h2 id="contact-method">
          Contact Method
        </h2>

        <p>
          The primary contact address for Sharpixa is:
        </p>

        <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-indigo-500">
            Email
          </p>

          <p className="mt-2">
            <a href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <p>
          Use a clear subject line such as “Technical Support,” “Privacy
          Request,” “Copyright Report,” or “Responsible Use Report.”
        </p>
      </section>

      <section>
        <h2 id="technical-support">
          Technical Support
        </h2>

        <p>
          For a processing or interface problem, include:
        </p>

        <ul>
          <li>The Sharpixa tool you were using.</li>
          <li>Your browser name and version.</li>
          <li>Your operating system and device type.</li>
          <li>The file format and approximate file size.</li>
          <li>The processing options selected.</li>
          <li>The exact error message shown.</li>
          <li>
            A screenshot that does not expose confidential or private content.
          </li>
        </ul>

        <p>
          Do not send the original media file unless Sharpixa specifically asks
          for it and you are permitted to share it.
        </p>
      </section>

      <section>
        <h2 id="copyright-reports">
          Copyright and Ownership Reports
        </h2>

        <p>
          Sharpixa does not host a public library of user-uploaded media as part
          of its core processing workflow. However, copyright or ownership
          concerns relating to Sharpixa’s own website content can be reported
          through the contact address.
        </p>

        <p>
          A useful report should include:
        </p>

        <ul>
          <li>Your full name and preferred contact information.</li>
          <li>
            Identification of the protected work or ownership interest.
          </li>
          <li>
            The exact Sharpixa page or resource connected to the concern.
          </li>
          <li>
            A clear explanation of why you believe the use is unauthorized.
          </li>
          <li>
            A statement confirming that the information supplied is accurate.
          </li>
        </ul>

        <p>
          Do not submit false, misleading, or abusive reports.
        </p>
      </section>

      <section>
        <h2 id="privacy-requests">
          Privacy Requests
        </h2>

        <p>
          Privacy questions and requests should use the subject line “Privacy
          Request.” Explain the relevant interaction with Sharpixa and the
          specific action or information you are requesting.
        </p>

        <p>
          Sharpixa may request reasonable information to verify that a person
          is authorized to make a request. Do not send identity documents
          unless they are specifically required and a secure method has been
          provided.
        </p>

        <p>
          The handling of browser processing, advertising resources, cookies,
          and third-party services is described in the{" "}
          <a href="/privacy/">
            Privacy Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2 id="responsible-use-reports">
          Responsible-Use Reports
        </h2>

        <p>
          Report suspected misuse of Sharpixa when the conduct directly
          involves the service, its website, or its publicly distributed
          materials.
        </p>

        <p>
          Include the relevant page, date, supporting information, and a
          concise explanation. Do not attempt to gain unauthorized access to
          another person’s files or accounts when gathering evidence.
        </p>

        <p>
          Review the{" "}
          <a href="/responsible-use/">
            Responsible Use Policy
          </a>{" "}
          before submitting a report.
        </p>
      </section>

      <section>
        <h2 id="response-information">
          Response Information
        </h2>

        <p>
          Sharpixa reviews messages according to their urgency, clarity, and
          relevance. A response time is not guaranteed, particularly for
          incomplete, automated, abusive, or unrelated messages.
        </p>

        <p>
          Technical reports may be used to diagnose defects and improve the
          service. Personal information included in a message should be limited
          to what is necessary for that purpose.
        </p>
      </section>
    </InfoPage>
  );
}