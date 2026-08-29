'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, type PipelineStage } from '@/lib/services/pipeline';
import { updatePipelineStageAction } from '@/app/(app)/followups/actions';

export interface PipelineCard {
  id: string;
  clientName: string;
  destination: string | null;
  travelDate: string | null;
  stage: PipelineStage;
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function KanbanBoard({ cards: initialCards }: { cards: PipelineCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // A small drag threshold — without it, a plain click (to navigate into
  // the quotation) can get misread as the start of a drag on touch devices.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const quotationId = String(active.id);
    const newStage = String(over.id) as PipelineStage;
    const card = cards.find((c) => c.id === quotationId);
    if (!card || card.stage === newStage) return;

    // Optimistic move — the board should feel instant; revert on failure.
    const previousStage = card.stage;
    setCards((cs) => cs.map((c) => (c.id === quotationId ? { ...c, stage: newStage } : c)));
    startTransition(async () => {
      const result = await updatePipelineStageAction(quotationId, newStage);
      if (!result.ok) {
        setCards((cs) => cs.map((c) => (c.id === quotationId ? { ...c, stage: previousStage } : c)));
        router.refresh();
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <Column key={stage} stage={stage} cards={cards.filter((c) => c.stage === stage)} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({ stage, cards }: { stage: PipelineStage; cards: PipelineCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-lg border transition-colors ${
        isOver ? 'border-harbor-400 bg-harbor-50' : 'border-sand-200 bg-sand-50'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-700">{PIPELINE_STAGE_LABELS[stage]}</h3>
        <span className="font-ticket text-xs text-ink-500">{cards.length}</span>
      </div>
      <div className="flex-1 space-y-2 px-2 pb-2" style={{ minHeight: 60 }}>
        {cards.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function Card({ card }: { card: PipelineCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-md border border-sand-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* The card itself is the drag handle; a separate Link underneath
          handles the click-to-open behavior so dragging and navigating
          don't fight each other — dnd-kit suppresses click events that
          follow a real drag automatically. */}
      <Link href={`/quotations/${card.id}`} className="block">
        <p className="text-sm font-medium text-ink-900">{card.clientName}</p>
        {card.destination && <p className="mt-0.5 text-xs text-ink-500">{card.destination}</p>}
        {card.travelDate && <p className="mt-0.5 font-ticket text-xs text-ink-500">{formatDate(card.travelDate)}</p>}
      </Link>
    </div>
  );
}
