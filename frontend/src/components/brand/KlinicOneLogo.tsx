import { useId } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import {
  WORDMARK_ASPECT,
  WORDMARK_KLINIC_PATH,
  WORDMARK_ONE_PATH,
  WORDMARK_VIEWBOX,
} from "./klinicOnePaths";

/** Degradê do símbolo: teal (painel/landing) ou índigo (Console KlinicOne). */
const MARK_GRADIENTS = {
  teal: ["#22BBAA", "#0E7C7B"],
  console: ["#7C86E8", "#3B44A8"],
} as const;

export type KlinicOneMarkVariant = keyof typeof MARK_GRADIENTS;

/** Símbolo KlinicOne: "K" com hastes em folha sobre bloco arredondado (mesmo desenho do favicon). */
export function KlinicOneMark({
  size = 40,
  variant = "teal",
  sx,
}: {
  size?: number;
  variant?: KlinicOneMarkVariant;
  sx?: SxProps<Theme>;
}) {
  const gradientId = `k1-mark-${useId().replace(/:/g, "")}`;
  const [from, to] = MARK_GRADIENTS[variant];
  return (
    <Box
      component="svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      sx={{ display: "block", flexShrink: 0, ...sx }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gradientId})`} />
      <rect x="17" y="14" width="8.5" height="36" rx="4.25" fill="#fff" />
      <path
        d="M27.5 32.6C28.6 21.6 35.4 15.2 47.5 14.2C46.6 25.4 39.6 31.8 27.5 32.6Z"
        fill="#fff"
      />
      <path
        d="M27.5 31.4C39.6 32.2 46.6 38.6 47.5 49.8C35.4 48.8 28.6 42.4 27.5 31.4Z"
        fill="#fff"
        fillOpacity={0.72}
      />
    </Box>
  );
}

/**
 * Nome "KlinicOne" em paths (sem depender da fonte carregada).
 * `color` pinta "Klinic"; `accentColor` pinta "One" (padrão: teal do tema, mais claro no escuro).
 * Aceitam tokens do tema (ex.: 'text.primary') ou cores literais.
 */
export function KlinicOneWordmark({
  height = 20,
  color = "text.primary",
  accentColor,
  sx,
}: {
  height?: number;
  color?: string;
  accentColor?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="svg"
      viewBox={WORDMARK_VIEWBOX}
      height={height}
      width={Math.round(height * WORDMARK_ASPECT)}
      role="img"
      aria-label="KlinicOne"
      sx={{ display: "block", flexShrink: 0, ...sx }}
    >
      <Box
        component="path"
        d={WORDMARK_KLINIC_PATH}
        sx={{ fill: (t) => resolveColor(t, color) }}
      />
      <Box
        component="path"
        d={WORDMARK_ONE_PATH}
        sx={{
          fill: (t) =>
            accentColor
              ? resolveColor(t, accentColor)
              : t.palette.mode === "dark"
                ? "#5FD3C6"
                : "#15998B",
        }}
      />
    </Box>
  );
}

/** Converte 'text.primary' / 'primary.main' em cor do tema; cores literais passam direto. */
function resolveColor(theme: Theme, value: string): string {
  const resolved = value
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      theme.palette,
    );
  return typeof resolved === "string" ? resolved : value;
}
