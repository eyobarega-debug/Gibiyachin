import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { errMsg } from "../context/AuthContext";
import ImageUploader from "../components/ImageUploader";
import Icon from "../components/Icon";
import {
  Badge, Button, Card, EmptyState, ErrorBanner, Input, Modal, PageHeader,
  Spinner, SuccessBanner, Tabs, TextArea,
} from "../components/ui";
import { useConfirm } from "../components/ConfirmProvider";

const TABS = ["Products", "Orders", "Store", "Analytics"];
const ORDER_STATUS_TONE = {
  pending_payment: "warn", confirmed: "navy", ready: "accent", completed: "ok",
  cancellation_requested: "warn", cancelled: "danger",
};

export default function Merchant() {
  const [searchParams] = useSearchParams();
  const paramTab = searchParams.get("tab");
  const targetOrderId = searchParams.get("orderId");
  const [store, setStore] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(
    paramTab && TABS.includes(paramTab)
      ? paramTab
      : targetOrderId
      ? "Orders"
      : "Products"
  );

  useEffect(() => {
    if (paramTab && TABS.includes(paramTab)) {
      setTab(paramTab);
    } else if (targetOrderId && !paramTab) {
      setTab("Orders");
    }
  }, [paramTab, targetOrderId]);

  async function loadStore() {
    try {
      const { data } = await client.get("/merchants/stores/mine");
      setStore(data.store);
    } catch (err) {
      setError(errMsg(err, "Could not load your store"));
    }
  }
  useEffect(() => {
    loadStore();
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!store) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <PageHeader title={store.name} subtitle="Merchant dashboard — products, orders, and store settings." />
      <Tabs items={TABS.map((t) => ({ key: t, label: t }))} value={tab} onChange={setTab} className="mb-6" />
      {tab === "Products" && <ProductsTab storeId={store.id} />}
      {tab === "Orders" && <OrdersTab targetOrderId={targetOrderId} />}
      {tab === "Store" && <StoreTab store={store} onSaved={setStore} />}
      {tab === "Analytics" && <AnalyticsTab storeId={store.id} />}
    </div>
  );
}

function ProductsTab({ storeId }) {
  const [products, setProducts] = useState(null);
  const [editing, setEditing] = useState(null); // product being edited, or {} for new
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [promoteFor, setPromoteFor] = useState(null);
  const [promoDays, setPromoDays] = useState("7");
  const [promoBusy, setPromoBusy] = useState(false);

  async function load() {
    const { data } = await client.get("/products", { params: { storeId } });
    setProducts(data.products);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function remove(id) {
    const ok = await confirm({
      title: "Remove product?",
      message: "This permanently deletes the listing from your store. This can't be undone.",
      confirmLabel: "Remove product",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await client.delete(`/products/${id}`);
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not remove product"));
    }
  }

  async function startPromotion(e) {
    e.preventDefault();
    const days = Number(promoDays);
    if (!days || days < 1) return;
    setPromoBusy(true);
    try {
      const { data } = await client.post(`/products/${promoteFor.id}/promote`, { days });
      navigate(`/mock-checkout/${data.payment.paymentId}`, {
        state: { amount: data.payment.amount, returnTo: "/merchant", label: `Feature "${promoteFor.title}" for ${days} day(s)` },
      });
    } catch (err) {
      setError(errMsg(err, "Could not start promotion"));
      setPromoBusy(false);
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({})}>Add product</Button>
      </div>
      {editing && (
        <ProductForm
          product={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onError={(e) => setError(errMsg(e, "Could not save product"))}
        />
      )}
      {!products ? (
        <Spinner className="my-8" />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products yet"
          subtitle="Add your first product to start selling on campus."
          action={<Button onClick={() => setEditing({})}>Add product</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-ink">{p.title}</p>
                <Badge tone={p.status === "active" ? "ok" : p.status === "out_of_stock" ? "warn" : "danger"}>{p.status}</Badge>
              </div>
              {p.featured_until && new Date(p.featured_until) > new Date() && (
                <Badge tone="accent">Featured until {new Date(p.featured_until).toLocaleDateString()}</Badge>
              )}
              <p className="mt-1 text-lg font-bold text-ink">{Number(p.price).toFixed(2)} <span className="text-xs font-medium text-muted">ETB</span></p>
              <p className="text-xs text-muted">{p.stock} in stock</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(p)}>Edit</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPromoDays("7");
                    setPromoteFor(p);
                  }}
                >
                  Feature
                </Button>
                <Button variant="danger" onClick={() => remove(p.id)}>Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!promoteFor}
        onClose={() => (promoBusy ? undefined : setPromoteFor(null))}
        title="Feature product"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPromoteFor(null)} disabled={promoBusy}>
              Cancel
            </Button>
            <Button type="submit" form="promote-form" loading={promoBusy}>
              Continue to payment
            </Button>
          </>
        }
      >
        <form id="promote-form" onSubmit={startPromotion} className="space-y-4">
          <p className="text-sm text-muted">
            Feature <span className="font-semibold text-ink">{promoteFor?.title}</span> on the marketplace homepage.
          </p>
          <Input
            label="Number of days"
            type="number"
            min="1"
            required
            value={promoDays}
            onChange={(e) => setPromoDays(e.target.value)}
            hint="20 ETB per day — you'll confirm payment on the next step."
            placeholder="7"
          />
        </form>
      </Modal>
    </div>
  );
}

function ProductForm({ product, onCancel, onSaved, onError }) {
  const isNew = !product.id;
  const [form, setForm] = useState({
    title: product.title || "",
    description: product.description || "",
    price: product.price || "",
    stock: product.stock ?? "",
    images: product.images || [],
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (form.price === "" || Number(form.price) < 0) errs.price = "Enter a valid price.";
    if (form.stock === "" || Number(form.stock) < 0) errs.stock = "Enter a valid stock quantity.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
    try {
      if (isNew) await client.post("/products", payload);
      else await client.patch(`/products/${product.id}`, payload);
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-4 text-base font-semibold text-ink">{isNew ? "Add product" : "Edit product"}</h3>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input
          label="Title"
          required
          placeholder="e.g. Calculus Textbook"
          value={form.title}
          error={errors.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <Input
          label="Price (ETB)"
          type="number"
          min="0"
          step="0.01"
          required
          placeholder="0.00"
          value={form.price}
          error={errors.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <Input
          label="Stock"
          type="number"
          min="0"
          required
          placeholder="Available quantity"
          value={form.stock}
          error={errors.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />
        <div className="sm:col-span-2">
          <TextArea
            label="Description"
            placeholder="Describe your product, condition, and pickup details…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-ink">Photos</p>
          <ImageUploader value={form.images} onChange={(images) => setForm({ ...form, images })} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={saving} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

const NEXT_STATUS = { confirmed: "ready", ready: "completed" };

function OrdersTab({ targetOrderId }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [notFoundNotice, setNotFoundNotice] = useState("");

  async function load() {
    const { data } = await client.get("/orders");
    setOrders(data.orders);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!orders || !targetOrderId) return;
    const found = orders.some((o) => o.id === targetOrderId);
    if (found) {
      setTimeout(() => {
        const el = document.getElementById(`merchant-order-${targetOrderId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    } else {
      setNotFoundNotice(`Order #${targetOrderId.slice(0, 8)} was not found in your active store orders.`);
    }
  }, [orders, targetOrderId]);

  async function advance(order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await client.patch(`/orders/${order.id}/status`, { status: next });
      load();
    } catch (err) {
      setError(errMsg(err, "Could not update order"));
    }
  }

  if (!orders) return <Spinner className="my-8" />;
  return (
    <div>
      <ErrorBanner message={error} />
      {notFoundNotice && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-xs text-amber-800 shadow-xs">
          <div className="flex items-center gap-2">
            <Icon name="info" className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{notFoundNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotFoundNotice("")}
            className="text-amber-700 hover:text-amber-900 font-bold ml-2 text-sm leading-none"
            aria-label="Dismiss notice"
          >
            &times;
          </button>
        </div>
      )}
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" subtitle="Orders from buyers will appear here once you start selling." />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const isTarget = targetOrderId === o.id;
            return (
              <Card
                key={o.id}
                id={`merchant-order-${o.id}`}
                className={`flex flex-wrap items-center justify-between gap-3 p-4 transition-all duration-300 ${
                  isTarget
                    ? "border-blue-500/90 bg-white shadow-xl ring-2 ring-blue-500/30 scale-[1.01]"
                    : "border-white/80"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-ink">Order #{o.id.slice(0, 8)} — {o.buyer_name}</p>
                    {isTarget && <Badge tone="accent">Selected from notification</Badge>}
                  </div>
                  <p className="text-xs text-muted">{Number(o.total_amount).toFixed(2)} ETB · {new Date(o.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={ORDER_STATUS_TONE[o.status] || "slate"}>{o.status.replaceAll("_", " ")}</Badge>
                {NEXT_STATUS[o.status] && (
                  <Button variant="outline" onClick={() => advance(o)}>Mark {NEXT_STATUS[o.status]}</Button>
                )}
              </div>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}

function StoreTab({ store, onSaved }) {
  const [form, setForm] = useState({ name: store.name, description: store.description || "" });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.name.trim()) {
      setNameError("Store name is required.");
      return;
    }
    setNameError("");
    setSaving(true);
    try {
      const { data } = await client.patch("/merchants/stores/mine", form);
      onSaved(data.store);
      setSuccess("Store updated.");
    } catch (err) {
      setError(errMsg(err, "Could not update store"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-lg p-5">
      <div className="mb-3 flex justify-end">
        <Link to={`/seller/${store.id}`} className="inline-flex items-center gap-1 text-sm text-ink underline decoration-slate-300 hover:decoration-slate-500">
          View public profile
          <Icon name="arrowRight" className="h-3.5 w-3.5" />
        </Link>
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        <Input
          label="Store name"
          required
          value={form.name}
          error={nameError}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <TextArea
          label="Description"
          placeholder="Tell buyers what your store sells…"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Button type="submit" loading={saving} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}

function AnalyticsTab({ storeId }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    client.get(`/merchants/${storeId}/analytics`).then(({ data }) => setStats(data));
  }, [storeId]);

  async function downloadCsv() {
    const { data } = await client.get(`/merchants/${storeId}/orders/export`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!stats) return <Spinner />;
  return (
    <div>
      <div className="mb-4">
        <Button variant="outline" onClick={downloadCsv}>
          <Icon name="download" className="h-4 w-4" />
          Export my orders CSV
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted">Completed orders revenue</p>
          <p className="text-3xl font-bold text-ink">{stats.revenue.toFixed(2)} <span className="text-base font-semibold text-muted">ETB</span></p>
          <p className="mt-1 text-xs text-muted">{stats.orderCount} total orders</p>
        </Card>
        <Card className="p-5">
          <p className="mb-2 text-sm font-semibold text-ink">Top products</p>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-muted">No sales yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.topProducts.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span className="text-muted">{p.title}</span>
                  <span className="font-medium text-ink">{p.units_sold} sold</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
