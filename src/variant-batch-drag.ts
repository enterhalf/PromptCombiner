import type { Variant } from "./types";

/**
 * 变体「整组拖动」的跨实例上下文。
 *
 * 背景：svelte-dnd-action 一次只搬运被按住的那一个条目，松手时派发的
 * finalize 里也只有这一条的最终位置。为了让「多选后拖动其中一个 = 整组一起
 * 移动」成立（同框重排 / 跨框移动都算），各个 TextBox 实例通过这个模块级
 * 单例交换信息：
 *
 *  - 源框：dragStarted 时写入本次跟随移动的整组变体（仅当被拖条目属于多选）；
 *  - 接收框：finalize 时读出来，把「被拖条目的落点」当作锚点，整组作为
 *    连续块插入；
 *  - 源框：finalize（droppedIntoAnother）时读出来，把留在原地的其余成员
 *    一并从本框移除；
 *  - 每次 dragStarted 都会先重置，避免上一次手势的残留影响下一次。
 */
export interface VariantBatchDrag {
  /** 发起拖动的 Text Box id */
  boxId: string;
  /** 本次一起移动的变体（保持它们在源框中的相对顺序） */
  variants: Variant[];
}

let current: VariantBatchDrag | null = null;

export function beginVariantBatchDrag(boxId: string, variants: Variant[]): void {
  current = { boxId, variants };
}

export function clearVariantBatchDrag(): void {
  current = null;
}

export function getVariantBatchDrag(): VariantBatchDrag | null {
  return current;
}
