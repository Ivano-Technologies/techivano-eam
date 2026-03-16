import { FeatureGrid } from "./FeatureGrid";

const useCases = [
  {
    title: "Federal Infrastructure Agencies",
    description:
      "Ministry of Works, Railway Corporation, Ports Authority, NNPC, FAAN. Centralize national infrastructure asset data, maintenance workflows, and compliance reporting across agencies.",
  },
  {
    title: "State Governments",
    description:
      "Lagos, Rivers, Kaduna, Ogun, FCT Abuja. Deploy multi-tenant EAM with state-level dashboards, site hierarchies, and predictive maintenance for roads, buildings, and utilities.",
  },
  {
    title: "Regulators",
    description:
      "SON, NAFDAC, NIMASA. Monitor regulated infrastructure, inspection workflows, and audit trails for compliance and safety oversight.",
  },
];

export function GovernmentUseCases() {
  return (
    <FeatureGrid
      title="Built for Government Infrastructure"
      subtitle="Techivano supports federal agencies, state governments, and regulators with secure, multi-tenant deployment and role-based access."
      features={useCases}
      columns={3}
      className="bg-slate-50 dark:bg-slate-900/50"
    />
  );
}
