import {
  ArrowLeft,
  ImagePlus,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  PackagePlus,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useCafeStore,
  type MenuItemInput,
} from "@/features/cafe/store/cafeStore";
import type { MenuItem } from "@/features/cafe/types/menu";
import { useMenuImageSource } from "@/features/cafe/hooks/useMenuImageSource";
import {
  createMenuImageKey,
  deleteMenuImage,
  resolveMenuImage,
  saveMenuImage,
} from "@/features/cafe/utils/menuImageStorage";

const menuCategories: MenuItem["category"][] = [
  "Snacks",
  "Fast Food",
  "Drinks",
  "Tea / Coffee",
  "Desserts",
  "Other",
];

const emptyForm: MenuItemInput = {
  name: "",
  category: "Fast Food",
  price: 0,
  emoji: "",
  imageDataUrl: "",
  imageKey: undefined,
  isAvailable: true,
  trackStock: false,
  currentStock: 0,
  lowStockAlertQuantity: 0,
  stockUnit: "pcs",
  baseStockUnit: "pcs",
  purchaseUnit: "pcs",
  purchaseConversionQuantity: 1,
  saleOptions: [],
};

type StockFilter = "all" | "tracked" | "low" | "out" | "untracked";

function MenuItemThumbnail({ item }: { item: MenuItem }) {
  const imageSource = useMenuImageSource(item);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  if (!imageSource || imageFailed) {
    return <span className="mr-2">{item.emoji}</span>;
  }

  return (
    <img
      src={imageSource}
      alt=""
      className="mr-2 inline-block h-10 w-10 rounded object-cover align-middle"
      onError={() => setImageFailed(true)}
    />
  );
}

function MenuManagementPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    menu,
    addMenuItem,
    updateMenuItem,
    toggleMenuItemAvailability,
    deleteMenuItem,
    adjustStock,
  } = useCafeStore();

  const [form, setForm] =
    useState<MenuItemInput>(emptyForm);
  const [editingItem, setEditingItem] =
    useState<MenuItem | null>(null);
  const [error, setError] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [stockItem, setStockItem] = useState<MenuItem | null>(null);
  const [stockAction, setStockAction] = useState<"add" | "remove" | "set">("add");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [stockError, setStockError] = useState("");

  const handlePhotoChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = reject;
        nextImage.src = source;
      });
      const maxSide = 900;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);

      setForm((current) => ({
        ...current,
        imageDataUrl: canvas.toDataURL("image/jpeg", 0.82),
      }));
      setError("");
    } catch {
      setError("The selected photo could not be loaded.");
    }
  };

  const summary = useMemo(() => {
    const available = menu.filter(
      (item) =>
        item.isAvailable ??
        item.available
    ).length;

    return {
      total: menu.length,
      available,
      unavailable:
        menu.length - available,
      categories: new Set(
        menu.map((item) => item.category)
      ).size,
    };
  }, [menu]);

  const sortedMenu = useMemo(
    () =>
      menu.filter((item) => {
        const tracked = item.trackStock === true;
        const stock = Math.max(0, item.currentStock ?? 0);
        const low = tracked && stock > 0 && stock <= Math.max(0, item.lowStockAlertQuantity ?? 0);
        if (stockFilter === "tracked") return tracked;
        if (stockFilter === "untracked") return !tracked;
        if (stockFilter === "low") return low;
        if (stockFilter === "out") return tracked && stock === 0;
        return true;
      }).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [menu, stockFilter]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingItem(null);
  };

  const handleSubmit = async (
    event: FormEvent
  ) => {
    event.preventDefault();
    setError("");

    const name = form.name.trim();

    if (!name) {
      setError("Item name is required.");
      return;
    }

    if (!form.category) {
      setError("Category is required.");
      return;
    }

    if (!form.price || form.price <= 0) {
      setError("Price must be greater than 0.");
      return;
    }
    if (form.trackStock && (!Number.isInteger(form.currentStock) || form.currentStock < 0 || !Number.isInteger(form.lowStockAlertQuantity) || form.lowStockAlertQuantity < 0 || !form.baseStockUnit.trim() || !form.purchaseUnit.trim() || !Number.isInteger(form.purchaseConversionQuantity) || form.purchaseConversionQuantity <= 0)) {
      setError("Tracked stock requires whole-number quantities, base unit, purchase unit, and a positive conversion quantity.");
      return;
    }
    if (form.trackStock && form.saleOptions.some((option) => !option.label.trim() || option.price <= 0 || !Number.isInteger(option.stockDeductionQuantity) || option.stockDeductionQuantity <= 0)) {
      setError("Sale options require a label, price, and positive stock deduction.");
      return;
    }

    let imageKey = form.imageKey;
    let legacyImageDataUrl = form.imageDataUrl;

    try {
      if (form.imageDataUrl?.startsWith("data:image/")) {
        imageKey ??= createMenuImageKey(editingItem?.id);
        await saveMenuImage(imageKey, form.imageDataUrl);
        legacyImageDataUrl = undefined;
      } else if (!form.imageDataUrl && editingItem?.imageKey) {
        await deleteMenuImage(editingItem.imageKey);
        imageKey = undefined;
      }
    } catch {
      setError("The product photo could not be saved. Please try again.");
      return;
    }

    const input: MenuItemInput = {
      ...form,
      name,
      emoji: form.emoji?.trim(),
      imageKey,
      imageDataUrl: legacyImageDataUrl,
    };

    if (editingItem) {
      updateMenuItem(editingItem.id, input);
      toast.success({
        title: "Menu Item Updated",
        description: `${name} was updated successfully.`,
      });
    } else {
      addMenuItem(input);
      toast.success({
        title: "Menu Item Added",
        description: `${name} is now available in Menu Management.`,
      });
    }

    resetForm();
  };

  const handleEdit = async (item: MenuItem) => {
    const imageSource = await resolveMenuImage(item).catch(
      () => item.imageDataUrl
    );
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      price: item.price,
      emoji: item.emoji ?? "",
      imageDataUrl: imageSource ?? "",
      imageKey: item.imageKey,
      isAvailable:
        item.isAvailable ??
        item.available,
      trackStock: item.trackStock ?? false,
      currentStock: Math.max(0, item.currentStock ?? 0),
      lowStockAlertQuantity: Math.max(0, item.lowStockAlertQuantity ?? 0),
      stockUnit: item.stockUnit ?? "pcs",
      baseStockUnit: item.baseStockUnit ?? item.stockUnit ?? "pcs",
      purchaseUnit: item.purchaseUnit ?? item.stockUnit ?? "pcs",
      purchaseConversionQuantity: item.purchaseConversionQuantity ?? 1,
      saleOptions: item.saleOptions ?? [],
    });
    setError("");
  };

  const submitStockAdjustment = () => {
    if (!stockItem) return;
    try {
      adjustStock(stockItem.id, stockAction, Number(stockQuantity), stockNote);
      setStockItem(null);
      setStockQuantity("");
      setStockNote("");
      setStockError("");
      toast.success({
        title: "Stock Updated",
        description: `${stockItem.name} stock was updated successfully.`,
      });
    } catch (caught) {
      setStockError(caught instanceof Error ? caught.message : "Stock could not be updated.");
    }
  };

  const handleDelete = async (item: MenuItem) => {
    const confirmed = window.confirm(
      `Delete ${item.name}? Existing orders and sales will keep their old item details.`
    );

    if (!confirmed) return;

    await deleteMenuImage(item.imageKey).catch(() => undefined);
    deleteMenuItem(item.id);
    toast.success({
      title: "Menu Item Deleted",
      description: `${item.name} was removed from the menu.`,
    });

    if (editingItem?.id === item.id) {
      resetForm();
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-slate-950">
              Menu Management
            </h1>
            <p className="text-sm text-slate-500">
              Add items, change prices, and control availability.
            </p>
          </div>
          <Button className="gap-2" onClick={() => navigate("/admin/menu/vendor-restocking")}><PackagePlus className="h-4 w-4" /> Vendor Restocking</Button>
        </div>

        <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            ["Total Items", summary.total],
            ["Available Items", summary.available],
            ["Unavailable Items", summary.unavailable],
            ["Categories Count", summary.categories],
          ].map(([label, value]) => (
            <Card
              key={label}
              className="rounded-lg bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {value}
              </p>
            </Card>
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Card className="p-4">
            <h2 className="mb-4 font-bold text-slate-950">
              {editingItem
                ? "Edit Menu Item"
                : "Add Menu Item"}
            </h2>

            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <form
              className="space-y-4"
              onSubmit={handleSubmit}
            >
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Item name
                </label>
                <Input
                  className="mt-1"
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Category
                </label>
                <Input
                  className="mt-1"
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value,
                    })
                  }
                  list="menu-category-options"
                />
                <datalist id="menu-category-options">
                  {menuCategories.map((category) => (
                    <option
                      key={category}
                      value={category}
                    />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-slate-500">
                  Pick a suggestion or type a new category.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Price
                </label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={form.price || ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      price:
                        Number(
                          event.target.value
                        ) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Emoji / Icon
                </label>
                <Input
                  className="mt-1"
                  value={form.emoji ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      emoji: event.target.value,
                    })
                  }
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Product photo
                </label>
                {form.imageDataUrl ? (
                  <div className="relative mt-1 overflow-hidden rounded-lg border bg-slate-100">
                    <img
                      src={form.imageDataUrl}
                      alt="Product preview"
                      className="h-44 w-full object-contain"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      title="Remove photo"
                      className="absolute right-2 top-2"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          imageDataUrl: "",
                        }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                <label className="mt-2 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50">
                  <ImagePlus className="h-4 w-4" />
                  {form.imageDataUrl ? "Replace photo" : "Choose photo from PC"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isAvailable:
                        event.target.checked,
                    })
                  }
                />
                Available in Cafe POS
              </label>

              <div className="rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={form.trackStock} onChange={(event) => setForm({ ...form, trackStock: event.target.checked })} />
                  Track Stock
                </label>
                {form.trackStock && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><label className="text-xs font-medium text-slate-600">Current Stock</label><Input className="mt-1" type="number" min={0} step={1} value={form.currentStock} disabled={Boolean(editingItem?.trackStock)} onChange={(event) => setForm({ ...form, currentStock: Number(event.target.value) })} />{editingItem?.trackStock && <p className="mt-1 text-xs text-slate-500">Use the Stock action to change quantity.</p>}</div>
                    <div><label className="text-xs font-medium text-slate-600">Low Stock Alert At</label><Input className="mt-1" type="number" min={0} step={1} value={form.lowStockAlertQuantity} onChange={(event) => setForm({ ...form, lowStockAlertQuantity: Number(event.target.value) })} /></div>
                    <div><label className="text-xs font-medium text-slate-600">Base Stock Unit</label><Input className="mt-1" value={form.baseStockUnit} onChange={(event) => setForm({ ...form, baseStockUnit: event.target.value, stockUnit: event.target.value })} placeholder="pcs, cigarette, bottle" /></div>
                    <div><label className="text-xs font-medium text-slate-600">Purchase Unit</label><Input className="mt-1" value={form.purchaseUnit} onChange={(event) => setForm({ ...form, purchaseUnit: event.target.value })} placeholder="pcs, pack, carton" /></div>
                    <div><label className="text-xs font-medium text-slate-600">Conversion Quantity</label><Input className="mt-1" type="number" min={1} step={1} value={form.purchaseConversionQuantity} onChange={(event) => setForm({ ...form, purchaseConversionQuantity: Number(event.target.value) })} /></div>
                    <div className="flex items-end text-xs text-slate-500">1 {form.purchaseUnit || "purchase unit"} = {form.purchaseConversionQuantity || 0} {form.baseStockUnit || "base units"}</div>
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-slate-600">Sale Options</label>
                        <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, saleOptions: [...form.saleOptions, { id: `OPTION-${Date.now()}`, label: "", price: form.price || 0, stockDeductionQuantity: 1 }] })}>Add Option</Button>
                      </div>
                      <div className="mt-2 space-y-2">
                        {(form.saleOptions.length > 0 ? form.saleOptions : [{ id: "default-preview", label: form.baseStockUnit || "pcs", price: form.price || 0, stockDeductionQuantity: 1 }]).map((option, index) => (
                          <div key={option.id} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_90px_90px_auto]">
                            <Input value={option.label} disabled={form.saleOptions.length === 0} onChange={(event) => setForm({ ...form, saleOptions: form.saleOptions.map((current) => current.id === option.id ? { ...current, label: event.target.value } : current) })} placeholder="Pack or Loose" />
                            <Input type="number" min={1} value={option.price || ""} disabled={form.saleOptions.length === 0} onChange={(event) => setForm({ ...form, saleOptions: form.saleOptions.map((current) => current.id === option.id ? { ...current, price: Number(event.target.value) || 0 } : current) })} placeholder="Price" />
                            <Input type="number" min={1} step={1} value={option.stockDeductionQuantity || ""} disabled={form.saleOptions.length === 0} onChange={(event) => setForm({ ...form, saleOptions: form.saleOptions.map((current) => current.id === option.id ? { ...current, stockDeductionQuantity: Number(event.target.value) || 0 } : current) })} placeholder="Deduct" />
                            <Button type="button" size="icon" variant="outline" disabled={form.saleOptions.length === 0} onClick={() => setForm({ ...form, saleOptions: form.saleOptions.filter((current) => current.id !== option.id) })}><Trash2 className="h-4 w-4" /></Button>
                            {index === 0 && form.saleOptions.length === 0 && <p className="text-xs text-slate-500 sm:col-span-4">Default sale option uses product price and deducts 1 {form.baseStockUnit || "base unit"}.</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button type="submit">
                  <Plus className="h-4 w-4" />
                  {editingItem ? "Save" : "Add"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Clear
                </Button>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              {([ ["all", "All"], ["tracked", "Stock Tracked"], ["low", "Low Stock"], ["out", "Out of Stock"], ["untracked", "Untracked"] ] as const).map(([value, label]) => (
                <Button key={value} type="button" size="sm" variant={stockFilter === value ? "default" : "outline"} onClick={() => setStockFilter(value)}>{label}</Button>
              ))}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMenu.map((item) => {
                  const available =
                    item.isAvailable ??
                    item.available;
                  const stock = Math.max(0, item.currentStock ?? 0);
                  const tracked = item.trackStock === true;
                  const lowStock = tracked && stock > 0 && stock <= Math.max(0, item.lowStockAlertQuantity ?? 0);

                  return (
                    <tr
                      key={item.id}
                      className="border-t bg-white"
                    >
                      <td className="px-4 py-3 font-semibold">
                        <MenuItemThumbnail item={item} />
                        {item.name}
                      </td>
                      <td className="px-4 py-3">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!tracked ? (
                          <span className="text-xs text-slate-500">Untracked</span>
                        ) : stock === 0 ? (
                          <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">Out of Stock</span>
                        ) : lowStock ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">Low Stock · {stock} {item.stockUnit || "pcs"}</span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700">{stock} {item.stockUnit || "pcs"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        Rs. {item.price}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            available
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                          }`}
                        >
                          {available
                            ? "Available"
                            : "Unavailable"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {tracked && <Button variant="outline" size="sm" onClick={() => { setStockItem(item); setStockAction("add"); setStockQuantity(""); setStockNote(""); setStockError(""); }}><PackagePlus className="h-4 w-4" /> Stock</Button>}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEdit(item)
                            }
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleMenuItemAvailability(
                                item.id
                              )
                            }
                          >
                            {available ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                            {available
                              ? "Disable"
                              : "Enable"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleDelete(item)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(stockItem)} onOpenChange={(open) => !open && setStockItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adjust Stock - {stockItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Current stock: <strong>{Math.max(0, stockItem?.currentStock ?? 0)} {stockItem?.stockUnit || "pcs"}</strong></p>
            <div><label className="text-sm font-medium">Action</label><select className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={stockAction} onChange={(event) => setStockAction(event.target.value as "add" | "remove" | "set")}><option value="add">Add Stock</option><option value="remove">Remove Stock</option><option value="set">Set Exact Quantity</option></select></div>
            <div><label className="text-sm font-medium">Quantity</label><Input className="mt-1" type="number" min={0} step={1} value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} /></div>
            <div><label className="text-sm font-medium">Note</label><Input className="mt-1" value={stockNote} onChange={(event) => setStockNote(event.target.value)} placeholder="Vendor delivery, damaged, count correction" /></div>
            {stockError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{stockError}</p>}
            <Button className="w-full" onClick={submitStockAdjustment}>Save Stock Adjustment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default MenuManagementPage;
