# Threat Dragon model

STRIDE data-flow model for the phishing awareness simulator (documentation section 4.2).

## Open the model

1. Install [OWASP Threat Dragon](https://owasp.org/www-project-threat-dragon/) (desktop) or use the [web app](https://www.threatdragon.com/).
2. Open or import `phishing-awareness-simulator-stride.json`.
3. Use **Context diagram** for the system boundary, then **Phishing simulator L1** for processes, stores, flows, and trust boxes.

Red outlines mean the element still has **Open** threats. Mitigated threats stay on the element but the outline is not red.

## Diagrams

- **Context diagram:** participant, researcher, the simulator, and Google Cloud / Firebase (platform out of scope). Trust boundary TB4 is the public internet versus Hosting.
- **Phishing simulator L1:** P1–P6, DS1–DS8 (campaigns added as DS8), TB1–TB4, and the STRIDE items from section 4.5.

## Regenerate

```bash
python docs/threat-model/generate_stride_model.py
```
