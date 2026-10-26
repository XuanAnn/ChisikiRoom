package com.chisikiroom.common.infrastructure;

import jakarta.persistence.*;
import java.util.*;
import org.springframework.stereotype.Repository;

/** Typed JPA access. JPQL operates on mapped entities, never physical SQL tables.
 * Callers own the transaction; managed entity changes are flushed at commit.
 */
@Repository
public class JpaStore {

    @PersistenceContext
    private EntityManager entityManager;

    public <T> Optional<T> find(Class<T> type, Object id) {
        return Optional.ofNullable(entityManager.find(type, id));
    }

    public <T> Optional<T> lock(Class<T> type, Object id) {
        T entity = entityManager.find(type, id);
        // A previous read in this persistence context may predate another
        // transaction's commit while waiting for the aggregate lock.
        if (entity != null && entityManager.getLockMode(entity) != LockModeType.PESSIMISTIC_WRITE) {
            entityManager.refresh(entity, LockModeType.PESSIMISTIC_WRITE);
        }
        return Optional.ofNullable(entity);
    }

    public <T> List<T> list(Class<T> type, String jpql, Object... parameters) {
        return query(type, jpql, parameters).getResultList();
    }

    public <T> List<T> limited(Class<T> type, String jpql, int limit, Object... parameters) {
        return query(type, jpql, parameters).setMaxResults(limit).getResultList();
    }

    public <T> Optional<T> one(Class<T> type, String jpql, Object... parameters) {
        return query(type, jpql, parameters).setMaxResults(1).getResultList().stream().findFirst();
    }

    public boolean exists(String jpql, Object... parameters) {
        return one(Long.class, jpql, parameters).orElse(0L) > 0;
    }

    private <T> TypedQuery<T> query(Class<T> type, String jpql, Object... parameters) {
        if (parameters.length % 2 != 0) {
            throw new IllegalArgumentException("Named parameter pairs required");
        }
        var query = entityManager.createQuery(jpql, type);
        for (int i = 0; i < parameters.length; i += 2) {
            query.setParameter((String) parameters[i], parameters[i + 1]);
        }
        return query;
    }

    public <T> T insert(T entity) {
        entityManager.persist(entity);
        return entity;
    }

    public void delete(Object entity) {
        entityManager.remove(entity);
    }

    public void flush() {
        entityManager.flush();
    }
}
