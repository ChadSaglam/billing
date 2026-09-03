from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_tenant_id
from app.database import get_db
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("", response_model=list[ClientRead])
def list_clients(
    search: str | None = Query(None),
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
    return query.order_by(Client.company_name).all()


@router.get("/{client_id}", response_model=ClientRead)
def get_client(client_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == tenant_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.post("", response_model=ClientRead, status_code=201)
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


@router.put("/{client_id}", response_model=ClientRead)
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == tenant_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == tenant_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()