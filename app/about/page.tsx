import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "About Sharpixa",

  description:
    "Learn what Sharpixa does, how its browser-based media tools work, and the principles guiding its development.",

  alternates: {
    canonical: "/about/",
  },

  openGraph: {
    type: "website",
    url: "/about/",
    title: "About Sharpixa | Sharpixa",
    description:
      "Learn about Sharpixa's browser-based object removal, background removal, and media-improvement tools.",
    siteName: "Sharpixa",
  },
};

const SECTIONS = [
  {
    id: "what-is-sharpixa",
    title: "What Sharpixa Is",
  },
  {
    id: "available-tools",
    title: "Available Tools",
  },
  {
    id: "browser-processing",
    title: "Browser Processing",
  },
  {
    id: "our-principles",
    title: "Our Principles",
  },
  {
    id: "limitations",
    title: "Current Limitations",
  },
  {
    id: "responsible-use",
    title: "Responsible Use",
  },
];

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="About the project"
      title="About Sharpixa"
      description="Sharpixa is a browser-based media utility designed to make focused image and video editing tasks easier to understand and complete."
      icon="sparkles"
      sections={SECTIONS}
      notice={
        <p>
          Sharpixa is an evolving independent web project. We describe current
          features and limitations honestly rather than promising results that
          conventional browser processing cannot consistently produce.
        </p>
      }
    >
      <section>
        <h2 id="what-is-sharpixa">
          What Sharpixa Is
        </h2>

        <p>
          Sharpixa provides focused tools for removing unwanted areas from
          media, separating image subjects from backgrounds, and improving the
          presentation of images or compatible videos.
        </p>

        <p>
          The project is designed around a simple workflow: choose the correct
          tool, upload a supported file, adjust the available controls, review
          the result, and export the processed file.
        </p>

        <p>
          Sharpixa does not require users to create an account before using its
          core editing tools.
        </p>
      </section>

      <section>
        <h2 id="available-tools">
          Available Tools
        </h2>

        <h3>
          Object and Text Removal
        </h3>

        <p>
          Users can manually mark an unwanted object, text overlay, date stamp,
          logo, distraction, or authorized watermark. Sharpixa then attempts to
          rebuild the selected area using visible pixels and textures from the
          surrounding region.
        </p>

        <h3>
          Background Removal
        </h3>

        <p>
          Automatic mode uses a subject-segmentation model to estimate which
          pixels belong to the foreground. Manual mode provides a selection
          editor for situations where automatic separation needs more control.
          Transparent results are exported as PNG files.
        </p>

        <h3>
          Image and Video Improvement
        </h3>

        <p>
          Sharpixa can resize files and apply practical adjustments including
          brightness, contrast, saturation, denoising, and controlled
          sharpening. These processes can improve presentation, but they do not
          reliably recreate details that were never captured in the source.
        </p>
      </section>

      <section>
        <h2 id="browser-processing">
          Browser-Based Processing
        </h2>

        <p>
          Sharpixa’s core editing workflow is designed to process selected
          files inside the user’s browser. This reduces the need to transfer
          source media to a Sharpixa file-processing server.
        </p>

        <p>
          The browser may still download application code, model files,
          runtime resources, fonts, analytics resources, or advertising
          resources. Browser caches may retain some of those resources to
          improve later loading times.
        </p>

        <p>
          Large images and videos can require substantial device memory and
          processing power. Performance therefore varies according to the
          browser, operating system, device hardware, source dimensions, file
          format, and selected processing options.
        </p>
      </section>

      <section>
        <h2 id="our-principles">
          Our Product Principles
        </h2>

        <ul>
          <li>
            <strong>Focused workflows:</strong> each tool should solve one
            clearly defined media-editing problem.
          </li>

          <li>
            <strong>Honest descriptions:</strong> features should be explained
            according to what the current implementation actually does.
          </li>

          <li>
            <strong>Manual control:</strong> users should be able to refine
            selections and settings rather than depending entirely on
            automatic processing.
          </li>

          <li>
            <strong>Useful guidance:</strong> limitations, supported formats,
            and quality considerations should be visible before processing.
          </li>

          <li>
            <strong>Responsible editing:</strong> the tools should be used only
            on media the user owns or has permission to modify.
          </li>

          <li>
            <strong>Accessible entry:</strong> core tools should remain
            available without requiring an account.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="limitations">
          Current Limitations
        </h2>

        <p>
          No browser-based media tool produces perfect results for every file.
          Object removal is more difficult when the selected object covers
          faces, hands, detailed architecture, unique text, or other structures
          that cannot be inferred from nearby pixels.
        </p>

        <p>
          Background removal can struggle with hair, fur, transparent objects,
          motion blur, shadows, similar foreground and background colors, and
          low-resolution edges.
        </p>

        <p>
          Video support depends on browser codec availability. A file extension
          alone does not guarantee that a particular browser can decode and
          encode the media.
        </p>

        <p>
          Very large resize settings can exceed available browser memory.
          Sharpixa may limit processing, reduce output size, or report an error
          when the requested operation cannot be completed safely.
        </p>
      </section>

      <section>
        <h2 id="responsible-use">
          Responsible Use
        </h2>

        <p>
          Sharpixa is intended for lawful editing of files that users own or
          are authorized to modify. The tools must not be used to remove
          copyright notices, ownership marks, attribution, evidence, or
          identifying information from protected material without permission.
        </p>

        <p>
          Additional expectations and examples are explained in the{" "}
          <a href="/responsible-use/">
            Responsible Use Policy
          </a>
          .
        </p>
      </section>
    </InfoPage>
  );
}