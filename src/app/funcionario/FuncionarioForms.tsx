"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./funcionario.module.css";
import {
  addDespesaAction,
  addProducaoAction,
  addVendaAction,
  fecharCaixaAction,
} from "./actions";

type ActionState =
  | { ok: true; message: string }
  | { ok: false; message: string; blocked?: boolean; details?: Record<string, string> };

function SubmitButton({ label, icon }: { label: string; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className={styles.button} type="submit" disabled={pending}>
      {pending ? (
        <span className={styles.spinner}></span>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}

function Status({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <div className={state.ok ? styles.ok : styles.err}>
      <div className={styles.statusHeader}>
        {state.ok ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        )}
        <span>{state.message}</span>
      </div>
      {!state.ok && state.details ? (
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span>Esperado:</span> <span>R$ {state.details.valorEsperado}</span>
          </div>
          <div className={styles.detailRow}>
            <span>Real:</span> <span>R$ {state.details.valorReal}</span>
          </div>
          {state.details.recebidas ? (
            <div className={styles.detailRow}>
              <span>Recebidas:</span> <span>R$ {state.details.recebidas}</span>
            </div>
          ) : null}
          {state.details.fiado ? (
            <div className={styles.detailRow}>
              <span>Fiado:</span> <span>R$ {state.details.fiado}</span>
            </div>
          ) : null}
          <div className={`${styles.detailRow} ${styles.diff}`}>
            <span>Diferença:</span> <span>R$ {state.details.diferenca}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function useResetForm(state: ActionState | null) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);
  return formRef;
}

function parseNumberInput(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function FuncionarioForms({
  defaultDate,
  initialPrecoLitro,
  litrosNoTurno,
  vendasTotalNoTurno,
}: {
  defaultDate: string;
  initialPrecoLitro: number | null;
  litrosNoTurno: number;
  vendasTotalNoTurno: number;
}) {
  const router = useRouter();
  const [producaoState, producaoAction] = useFormState<ActionState | null, FormData>(
    addProducaoAction,
    null,
  );
  const producaoRef = useResetForm(producaoState);
  const [precoLitroStr, setPrecoLitroStr] = useState(
    initialPrecoLitro == null ? "" : initialPrecoLitro.toFixed(2),
  );
  const [litrosNovoStr, setLitrosNovoStr] = useState("");

  useEffect(() => {
    if (producaoState?.ok) {
      setLitrosNovoStr("");
    }
  }, [producaoState]);

  const [vendaState, vendaAction] = useFormState<ActionState | null, FormData>(addVendaAction, null);
  const vendaRef = useResetForm(vendaState);

  const [despesaState, despesaAction] = useFormState<ActionState | null, FormData>(
    addDespesaAction,
    null,
  );
  const despesaRef = useResetForm(despesaState);

  const [fechamentoState, fechamentoAction] = useFormState<ActionState | null, FormData>(
    fecharCaixaAction,
    null,
  );
  const fechamentoRef = useResetForm(fechamentoState);

  useEffect(() => {
    if (producaoState?.ok) router.refresh();
  }, [producaoState, router]);
  useEffect(() => {
    if (vendaState?.ok) router.refresh();
  }, [vendaState, router]);
  useEffect(() => {
    if (despesaState?.ok) router.refresh();
  }, [despesaState, router]);
  useEffect(() => {
    if (fechamentoState?.ok) router.refresh();
  }, [fechamentoState, router]);

  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    const states = [producaoState, vendaState, despesaState, fechamentoState].filter(Boolean) as ActionState[];
    const last = states[states.length - 1] ?? null;
    if (!last) return;
    setToast({ ok: last.ok, message: last.message });
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [producaoState, vendaState, despesaState, fechamentoState]);

  const precoLitro = parseNumberInput(precoLitroStr);
  const litrosNovo = parseNumberInput(litrosNovoStr);
  const litrosDepois = litrosNoTurno + (litrosNovo ?? 0);
  const valorDesteRegistro = precoLitro == null || litrosNovo == null ? null : litrosNovo * precoLitro;
  const valorProducaoDepois = precoLitro == null ? null : litrosDepois * precoLitro;
  const faltaDepois =
    valorProducaoDepois == null ? null : valorProducaoDepois - vendasTotalNoTurno;

  return (
    <div className={styles.grid}>
      {toast ? (
        <div className={styles.toastWrap}>
          <div className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>
            {toast.message}
          </div>
        </div>
      ) : null}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.iconBox} style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <h2 className={styles.h2}>Produção</h2>
        </div>
        <form ref={producaoRef} action={producaoAction} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Data</label>
            <input name="data" className={styles.input} type="date" defaultValue={defaultDate} />
          </div>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Paneiros</label>
              <input name="paneiros" className={styles.input} inputMode="numeric" placeholder="0" />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Litros</label>
              <input
                name="litrosGerados"
                className={styles.input}
                inputMode="decimal"
                placeholder="0.0"
                value={litrosNovoStr}
                onChange={(e) => setLitrosNovoStr(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Preço do dia (R$ / litro)</label>
            <input
              className={styles.input}
              inputMode="decimal"
              placeholder="0.00"
              value={precoLitroStr}
              onChange={(e) => setPrecoLitroStr(e.target.value)}
            />
          </div>
          {precoLitro == null ? null : (
            <div className={styles.details}>
              <div className={styles.detailRow}>
                <span>Total deste registro:</span>{" "}
                <span>R$ {valorDesteRegistro == null ? "0.00" : valorDesteRegistro.toFixed(2)}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Total produção (turno):</span> <span>R$ {valorProducaoDepois?.toFixed(2)}</span>
              </div>
              <div className={`${styles.detailRow} ${styles.diff}`}>
                <span>{faltaDepois != null && faltaDepois < 0 ? "Sobrando:" : "Faltando:"}</span>{" "}
                <span>R$ {faltaDepois == null ? "0.00" : Math.abs(faltaDepois).toFixed(2)}</span>
              </div>
            </div>
          )}
          <SubmitButton label="Registrar Produção" />
          <Status state={producaoState} />
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.iconBox} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <h2 className={styles.h2}>Nova Venda</h2>
        </div>
        <form ref={vendaRef} action={vendaAction} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Data</label>
            <input name="data" className={styles.input} type="date" defaultValue={defaultDate} />
          </div>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Valor (R$)</label>
              <input name="valor" className={styles.input} inputMode="decimal" placeholder="0.00" />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Litros</label>
              <input name="litros" className={styles.input} inputMode="decimal" placeholder="Opcional" />
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Forma de Pagamento</label>
            <div className={styles.selectWrapper}>
              <select name="tipo" className={styles.select} defaultValue="PIX">
                <option value="PIX">Pix</option>
                <option value="CARTAO">Cartão</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="ENTREGA">Entrega</option>
                <option value="FIADO">Fiado</option>
              </select>
              <svg className={styles.selectArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <SubmitButton label="Registrar Venda" />
          <Status state={vendaState} />
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.iconBox} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
              <polyline points="17 18 23 18 23 12"></polyline>
            </svg>
          </div>
          <h2 className={styles.h2}>Despesa</h2>
        </div>
        <form ref={despesaRef} action={despesaAction} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Data</label>
            <input name="data" className={styles.input} type="date" defaultValue={defaultDate} />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Descrição</label>
            <input name="descricao" className={styles.input} placeholder="O que foi gasto?" />
          </div>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Categoria</label>
              <input name="categoria" className={styles.input} placeholder="Ex: Limpeza" />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Valor (R$)</label>
              <input name="valor" className={styles.input} inputMode="decimal" placeholder="0.00" />
            </div>
          </div>
          <SubmitButton label="Registrar Despesa" />
          <Status state={despesaState} />
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.iconBox} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 className={styles.h2}>Fechamento</h2>
        </div>
        <form ref={fechamentoRef} action={fechamentoAction} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Data</label>
            <input name="data" className={styles.input} type="date" defaultValue={defaultDate} />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Sobra (Litros)</label>
            <input name="sobraLitros" className={styles.input} inputMode="decimal" placeholder="0.0" />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Justificativa</label>
            <input name="justificativa" className={styles.input} placeholder="Apenas se houver divergência" />
          </div>
          <SubmitButton label="Fechar Caixa" />
          <Status state={fechamentoState} />
        </form>
      </section>
    </div>
  );
}
