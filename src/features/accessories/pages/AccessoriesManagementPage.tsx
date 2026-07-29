import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

import { type AccessoryItem, useAccessoriesStore } from "../store/accessoriesStore";

const categories: AccessoryItem["category"][] = ["Tips", "Sticks", "Gloves", "Chalk", "Other"];

export default function AccessoriesManagementPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const items = useAccessoriesStore((state) => state.items);
  const addItem = useAccessoriesStore((state) => state.addItem);
  const updateItem = useAccessoriesStore((state) => state.updateItem);
  const toggleItem = useAccessoriesStore((state) => state.toggleItem);
  const deleteItem = useAccessoriesStore((state) => state.deleteItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<AccessoryItem["category"]>("Other");
  const [error, setError] = useState("");

  const clearForm = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setCategory("Other");
    setError("");
  };

  const save = () => {
    const amount = Number(price);
    if (!name.trim() || !price.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter an accessory name and a valid price greater than zero.");
      return;
    }
    const current = editingId ? items.find((item) => item.id === editingId) : undefined;
    const payload = { name: name.trim(), price: amount, category, available: current?.available ?? true };
    if (editingId) {
      updateItem(editingId, payload);
      toast.success({
        title: "Accessory Updated",
        description: `${payload.name} was updated successfully.`,
      });
    } else {
      addItem(payload);
      toast.success({
        title: "Accessory Added",
        description: `${payload.name} was added successfully.`,
      });
    }
    clearForm();
  };

  return (
    <PageShell width="wide">
      <div className="space-y-5">
        <header>
          <Button
            type="button"
            variant="ghost"
            className="mb-3 -ml-2 gap-2"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-slate-950">Accessories Management</h1>
          <p className="text-sm text-slate-500">Manage accessory products, prices, categories, and availability.</p>
        </header>
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit p-5">
            <h2 className="font-bold text-slate-950">{editingId ? "Edit Accessory" : "Add Accessory"}</h2>
            <div className="mt-4 space-y-3">
              <div><Label htmlFor="accessory-name">Name</Label><Input id="accessory-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
              <div><Label htmlFor="accessory-price">Price</Label><Input id="accessory-price" type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
              <div>
                <Label htmlFor="accessory-category">Category</Label>
                <select id="accessory-category" className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as AccessoryItem["category"])}>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <Button className="w-full gap-2" onClick={save}><Plus className="h-4 w-4" /> {editingId ? "Save Changes" : "Add Accessory"}</Button>
              {editingId && <Button variant="outline" className="w-full" onClick={clearForm}>Cancel</Button>}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3 font-bold text-slate-950">Accessory Products</div>
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.available ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{item.available ? "Available" : "Disabled"}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{item.category} · Rs. {item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditingId(item.id); setName(item.name); setPrice(String(item.price)); setCategory(item.category); setError(""); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleItem(item.id)}>{item.available ? "Disable" : "Enable"}</Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-red-700" onClick={() => { if (window.confirm(`Delete ${item.name}?`)) { deleteItem(item.id); toast.success({ title: "Accessory Deleted", description: `${item.name} was removed successfully.` }); if (editingId === item.id) clearForm(); } }}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No accessories configured.</p>}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
