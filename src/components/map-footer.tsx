import { useState } from "react";
import LegalModal from "./legal-modal";

interface MapFooterProps {
  overlayOffset?: number;
}

export default function MapFooter({ overlayOffset = 0 }: MapFooterProps) {
  const [modal, setModal] = useState<"disclaimer" | "privacy" | "sources" | null>(null);

  return (
    <>
      <div
        className="absolute bottom-1 left-4 md:left-6 z-10 flex items-center gap-1.5 text-[10px] text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] transition-all duration-300"
        style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
      >
        <span>For illustration only.</span>
        <button onClick={() => setModal("disclaimer")} className="underline underline-offset-2 hover:text-white transition-colors">Disclaimer</button>
        <span className="text-white/30">|</span>
        <button onClick={() => setModal("privacy")} className="underline underline-offset-2 hover:text-white transition-colors">Privacy</button>
        <span className="text-white/30">|</span>
        <button onClick={() => setModal("sources")} className="underline underline-offset-2 hover:text-white transition-colors">Sources</button>
      </div>

      <LegalModal open={modal === "disclaimer"} onClose={() => setModal(null)} title="Disclaimer">
        <p>
          CaliVibe is a personal, non-commercial project created for informational and educational purposes only. All data displayed on this site is provided <strong>&ldquo;as is&rdquo;</strong> without warranty of any kind, express or implied.
        </p>
        <p className="mt-3">
          The creators of this site make no representations or warranties regarding the accuracy, completeness, or timeliness of any data shown. Crime statistics, population figures, and geographic boundaries may contain errors or may not reflect the most current information.
        </p>
        <p className="mt-3">
          This site does not provide legal, financial, real estate, or any other professional advice. Do not make decisions based solely on the information presented here. Always consult official sources and qualified professionals.
        </p>
        <p className="mt-3">
          The creators shall not be held liable for any damages arising from the use of or reliance on the information provided on this site.
        </p>
        <p className="mt-3 text-xs text-gray-400">&copy; {new Date().getFullYear()} trekhleb.dev</p>
      </LegalModal>

      <LegalModal open={modal === "privacy"} onClose={() => setModal(null)} title="Privacy Policy">
        <p>
          CaliVibe does not collect, store, or process any personal data directly.
        </p>
        <p className="mt-3">
          This site uses <strong>Google Analytics</strong>, a web analytics service provided by Google LLC, to understand how visitors interact with the site. Google Analytics uses cookies and collects anonymized usage data (such as pages visited, time on site, and general location). This data is processed by Google in accordance with their{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Privacy Policy</a>.
        </p>
        <p className="mt-3">
          No personally identifiable information is intentionally collected. All map interactions and preferences (such as layer toggles) are stored locally in your browser via URL parameters and are not transmitted to any server.
        </p>
        <p className="mt-3">
          If you have questions about this privacy policy, contact the site creator at{" "}
          <a href="https://trekhleb.dev" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">trekhleb.dev</a>.
        </p>
      </LegalModal>

      <LegalModal open={modal === "sources"} onClose={() => setModal(null)} title="Data Sources">
        <ul className="space-y-3">
          <li>
            <strong>County &amp; City Crime Statistics</strong>
            <br />
            <a href="https://openjustice.doj.ca.gov/data" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">CA Department of Justice &mdash; OpenJustice</a>
            <br />
            <span className="text-gray-500">Crimes &amp; Clearances, 2023. Rates per 100K population.</span>
          </li>
          <li>
            <strong>Population Estimates</strong>
            <br />
            <a href="https://dof.ca.gov/forecasting/demographics/estimates-e1/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">CA Department of Finance</a>
            <br />
            <span className="text-gray-500">E-1 City/County Population Estimates, January 2024.<br />E-6 County Population Estimates, 2024.</span>
          </li>
          <li>
            <strong>County Boundaries</strong>
            <br />
            <a href="https://data.ca.gov/dataset/ca-geographic-boundaries" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">California Open Data Portal</a>
            <br />
            <span className="text-gray-500">US Census Bureau TIGER/Line, 2023.</span>
          </li>
          <li>
            <strong>City Boundaries</strong>
            <br />
            <a href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">US Census Bureau</a>
            <br />
            <span className="text-gray-500">TIGER/Line Places, 2024. 482 incorporated cities.</span>
          </li>
          <li>
            <strong>Temperature Data</strong>
            <br />
            <a href="https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">ERA5 Reanalysis (ECMWF)</a>
            {" "}via{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Open-Meteo</a>
            <br />
            <span className="text-gray-500">10-year monthly normals (2014–2023). H3 hex grid.</span>
          </li>
          <li>
            <strong>Elevation Data</strong>
            <br />
            <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">AWS Terrain Tiles</a>
            <br />
            <span className="text-gray-500">Used for the 3D relief visualization.</span>
          </li>
          <li>
            <strong>Map Tiles</strong>
            <br />
            <span className="text-gray-500">
              <a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">MapLibre GL JS</a> with{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">OpenStreetMap</a> data.
            </span>
          </li>
        </ul>
      </LegalModal>
    </>
  );
}
