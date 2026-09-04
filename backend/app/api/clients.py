from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_tenant_id, require_editor
from app.database import get_db
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientPage, ClientRead, ClientUpdate

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("", response_model=list[ClientRead] | ClientPage)
def list_clients(
    search: str | None = Query(None),
    page: int | None = Query(None, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    query = db.query(Client).filter(Client.tenant_id == tenant_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Client.company_name.ilike(pattern),
                Client.customer_number.ilike(pattern),
                Client.contact_person.ilike(pattern),
                Client.city.ilike(pattern),
            )
        )
    query = query.order_by(Client.company_name)

    # Backwards compatibility: without `page` the endpoint returns the plain
    # list it always did. New consumers pass ?page=1&page_size=… and get the
    # paginated envelope instead of the full table (R-13).
    if page is None:
        return query.all()

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return ClientPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{client_id}", response_model=ClientRead)
def get_client(client_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == tenant_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.post("", response_model=ClientRead, status_code=201, dependencies=[Depends(require_editor)])
def create_client(data: ClientCreate, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    existing = db.query(Client).filter(
        Client.tenant_id == tenant_id,
        Client.customer_number == data.customer_number,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Customer number {data.customer_number} already exists")

    client = Client(**data.model_dump(), tenant_id=tenant_id)
    db.add(client)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate client entry") from None
    db.refresh(client)
    return client


@router.put("/{client_id}", response_model=ClientRead, dependencies=[Depends(require_editor)])
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == tenant_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204, dependencies=[Depends(require_editor)])
def delete_client(client_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == tenant_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
