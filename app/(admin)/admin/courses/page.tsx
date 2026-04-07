'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StageRow {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
  owner: { userId: string; email: string } | null;
}

export default function AdminCoursesPage() {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stages');
      const data = await res.json();
      setStages(data.stages ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStages();
  }, [loadStages]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/stages?stageId=${encodeURIComponent(deleteId)}`, {
        method: 'DELETE',
      });
      setStages((prev) => prev.filter((s) => s.id !== deleteId));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Cursos generats</h1>
          <p className="text-muted-foreground mt-1">
            Tots els cursos del sistema amb el seu propietari.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Carregant…
          </div>
        ) : stages.length === 0 ? (
          <div className="border rounded-lg py-12 text-center text-muted-foreground text-sm">
            Encara no hi ha cap curs generat.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nom</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Escenes</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Propietari
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Data creació
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => (
                  <tr key={stage.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium max-w-xs truncate" title={stage.name}>
                      {stage.name || <span className="text-muted-foreground italic">Sense títol</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{stage.sceneCount}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {stage.owner ? (
                        <span title={stage.owner.userId}>{stage.owner.email}</span>
                      ) : (
                        <span className="italic text-muted-foreground/60">Desconegut</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {new Date(stage.createdAt).toLocaleString('ca-ES')}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                        onClick={() => setDeleteId(stage.id)}
                        title="Eliminar curs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar curs</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">
            Aquesta acció és irreversible. S&apos;eliminarà el curs i tot el seu contingut.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
