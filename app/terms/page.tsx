import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Terms of Use",

  description:
    "Read the terms governing access to and use of Sharpixa's browser-based image and video tools.",

  alternates: {
    canonical: "/terms/",
  },

  openGraph: {
    type: "website",
    url: "/terms/",
    title: "Terms of Use | Sharpixa",
    description:
      "Terms governing use of Sharpixa's website and browser-based media-editing tools.",
    siteName: "Sharpixa",
  },
};

const SECTIONS = [
  {
    id: "acceptance",
    title: "Acceptance",
  },
  {
    id: "service",
    title: "The Service",
  },
  {
    id: "eligibility",
    title: "Eligibility",
  },
  {
    id: "your-files",
    title: "Your Files",
  },
  {
    id: "permitted-use",
    title: "Permitted Use",
  },
  {
    id: "prohibited-use",
    title: "Prohibited Use",
  },
  {
    id: "results",
    title: "Results and Limitations",
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
  },
  {
    id: "third-parties",
    title: "Third Parties and Ads",
  },
  {
    id: "availability",
    title: "Availability",
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
  },
  {
    id: "liability",
    title: "Liability",
  },
  {
    id: "changes",
    title: "Changes",
  },
  {
    id: "contact",
    title: "Contact",
  },
];

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Rules for using Sharpixa"
      title="Terms of Use"
      description="These Terms explain the conditions that apply when you access Sharpixa or use its browser-based media-editing tools."
      icon="shield"
      lastUpdated="August 2, 2026"
      sections={SECTIONS}
      notice={
        <p>
          By accessing or using Sharpixa, you agree to these Terms. Do not use
          the service if you do not accept them.
        </p>
      }
    >
      <section>
        <h2 id="acceptance">
          1. Acceptance of the Terms
        </h2>

        <p>
          These Terms of Use form an agreement between the person using
          Sharpixa and the operator of the Sharpixa service.
        </p>

        <p>
          By accessing the website or processing a file, you confirm that you
          have read, understood, and agreed to these Terms and the{" "}
          <a href="/privacy/">
            Privacy Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2 id="service">
          2. Description of the Service
        </h2>

        <p>
          Sharpixa provides browser-based tools that may allow users to:
        </p>

        <ul>
          <li>Mark and remove unwanted image or video areas.</li>
          <li>Remove authorized text, logos, dates, or watermarks.</li>
          <li>Separate image subjects from backgrounds.</li>
          <li>Export transparent PNG files.</li>
          <li>Resize, denoise, sharpen, or adjust media.</li>
        </ul>

        <p>
          Features, supported formats, output options, algorithms, and
          availability may change over time.
        </p>
      </section>

      <section>
        <h2 id="eligibility">
          3. Eligibility
        </h2>

        <p>
          You must be legally capable of entering into an agreement under the
          laws that apply to you. A minor may use Sharpixa only with the
          permission and supervision of a parent or legal guardian where
          required.
        </p>
      </section>

      <section>
        <h2 id="your-files">
          4. Your Files and Responsibilities
        </h2>

        <p>
          You retain responsibility for the media you select, process, export,
          publish, or distribute.
        </p>

        <p>
          By processing a file, you represent that:
        </p>

        <ul>
          <li>You own the file or have permission to modify it.</li>
          <li>
            Your use does not infringe copyright, trademark, privacy,
            publicity, contractual, or other rights.
          </li>
          <li>
            Your use complies with applicable laws and professional
            obligations.
          </li>
          <li>
            The file and intended output are not being used for fraud,
            deception, harassment, or unlawful conduct.
          </li>
        </ul>

        <p>
          Sharpixa does not grant ownership or permission to edit material
          belonging to another person.
        </p>
      </section>

      <section>
        <h2 id="permitted-use">
          5. Permitted Use
        </h2>

        <p>
          Subject to these Terms, Sharpixa grants you a limited, revocable,
          non-exclusive right to access and use the website for lawful personal,
          creative, educational, or commercial editing activities.
        </p>

        <p>
          Permitted examples may include:
        </p>

        <ul>
          <li>Removing an object from your own photograph.</li>
          <li>
            Removing your own logo or watermark from a file when you possess
            the original rights.
          </li>
          <li>
            Editing licensed media where the licence permits modification.
          </li>
          <li>Preparing product images that you own or are authorized to use.</li>
          <li>Improving the presentation of your own image or video.</li>
        </ul>
      </section>

      <section>
        <h2 id="prohibited-use">
          6. Prohibited Use
        </h2>

        <p>
          You must not use Sharpixa to:
        </p>

        <ul>
          <li>
            Remove copyright notices, ownership marks, attribution, or
            watermarks without authorization.
          </li>
          <li>
            Falsify documents, evidence, identification, financial records,
            certificates, statements, receipts, or official communications.
          </li>
          <li>
            Misrepresent a person, product, event, transaction, or source.
          </li>
          <li>
            Facilitate fraud, impersonation, harassment, stalking, blackmail,
            or unlawful surveillance.
          </li>
          <li>
            Violate another person’s privacy, publicity, intellectual-property,
            or contractual rights.
          </li>
          <li>
            Remove safety labels, warnings, provenance information, or evidence
            in a misleading or harmful manner.
          </li>
          <li>
            Attack, overload, scrape, reverse engineer, bypass, or interfere
            with the service or its security controls.
          </li>
          <li>
            Distribute malware, automated abuse, or unlawful content through
            the website.
          </li>
        </ul>

        <p>
          Additional expectations appear in the{" "}
          <a href="/responsible-use/">
            Responsible Use Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2 id="results">
          7. Processing Results and Limitations
        </h2>

        <p>
          Results depend on the source file, selection quality, browser,
          available memory, device performance, codecs, processing settings,
          and the complexity of the requested edit.
        </p>

        <p>
          Object removal cannot reliably reconstruct unique details that are
          completely hidden by the selected object. Background separation may
          be imperfect around hair, fur, transparent materials, shadows, or
          low-contrast edges.
        </p>

        <p>
          Resizing and conventional enhancement increase dimensions or adjust
          visible pixels. They do not guarantee recovery of information that
          was absent from the source.
        </p>

        <p>
          You are responsible for reviewing the output before relying on,
          publishing, distributing, printing, or using it professionally.
        </p>
      </section>

      <section>
        <h2 id="intellectual-property">
          8. Sharpixa Intellectual Property
        </h2>

        <p>
          The Sharpixa name, branding, website design, original text, code,
          interfaces, and other service materials are protected by applicable
          intellectual-property laws.
        </p>

        <p>
          These Terms do not transfer ownership of Sharpixa’s website,
          branding, source code, or other protected materials to users.
        </p>

        <p>
          Third-party libraries, models, media, and software remain subject to
          their respective licences and ownership terms.
        </p>
      </section>

      <section>
        <h2 id="third-parties">
          9. Third-Party Services and Advertising
        </h2>

        <p>
          Sharpixa may use third-party hosting, content-delivery,
          machine-learning, advertising, consent-management, or security
          services.
        </p>

        <p>
          Advertisements and external links may lead to independent third-party
          websites. Sharpixa does not control or endorse every product, claim,
          policy, or transaction offered by an advertiser or external service.
        </p>

        <p>
          Your interaction with a third party is governed by that party’s own
          terms, privacy practices, and commercial arrangements.
        </p>
      </section>

      <section>
        <h2 id="availability">
          10. Service Availability
        </h2>

        <p>
          Sharpixa may modify, suspend, restrict, or discontinue all or part of
          the service. Maintenance, browser changes, model availability,
          hosting problems, security issues, or third-party failures may affect
          access.
        </p>

        <p>
          Continuous availability, compatibility, processing speed, or
          permanent preservation of a particular feature is not guaranteed.
        </p>
      </section>

      <section>
        <h2 id="disclaimers">
          11. Disclaimers
        </h2>

        <p>
          Sharpixa is provided on an “as available” and “as is” basis to the
          extent permitted by applicable law.
        </p>

        <p>
          No guarantee is made that every output will be accurate, natural,
          suitable for a particular purpose, free from artifacts, compatible
          with every device, or accepted by a third-party platform.
        </p>

        <p>
          Sharpixa does not provide legal, financial, forensic, medical, or
          professional certification services. Outputs should not be treated as
          verified evidence or an authoritative professional conclusion.
        </p>
      </section>

      <section>
        <h2 id="liability">
          12. Limitation of Liability
        </h2>

        <p>
          To the maximum extent permitted by applicable law, Sharpixa and its
          operator will not be liable for indirect, incidental, special,
          consequential, or punitive loss arising from use of or inability to
          use the service.
        </p>

        <p>
          This may include loss connected to corrupted files, failed exports,
          device limitations, browser incompatibility, publication decisions,
          third-party claims, lost opportunities, or reliance on a processed
          result.
        </p>

        <p>
          Nothing in these Terms excludes liability that cannot lawfully be
          excluded or limits mandatory consumer protections.
        </p>
      </section>

      <section>
        <h2 id="changes">
          13. Changes to These Terms
        </h2>

        <p>
          These Terms may be updated to reflect product changes, legal
          requirements, new features, security concerns, or service-provider
          changes.
        </p>

        <p>
          Continued use after an updated version becomes effective constitutes
          acceptance of the revised Terms to the extent permitted by law.
        </p>
      </section>

      <section>
        <h2 id="contact">
          14. Contact
        </h2>

        <p>
          Questions about these Terms can be submitted through the{" "}
          <a href="/contact/">
            Contact page
          </a>
          .
        </p>
      </section>
    </InfoPage>
  );
}