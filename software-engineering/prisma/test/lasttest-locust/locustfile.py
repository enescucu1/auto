"""Lasttest mit Locust für Auto-Projekt."""

from typing import Final
import urllib3  # type: ignore
from locust import HttpUser, constant_throughput, task  # type: ignore

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class AutoRequests(HttpUser):
    """Lasttest für HTTP-Requests für Auto-Service."""

    wait_time = constant_throughput(0.1)  # 50 Requests pro Sekunde
    MIN_USERS: Final = 500
    MAX_USERS: Final = 500

    def on_start(self) -> None:
        """Selbstsigniertes TLS-Zertifikat erlauben."""
        self.client.verify = False

    # -------------------------------------------------------------
    # GET /rest/<id>
    # -------------------------------------------------------------
    @task(100)
    def get_id(self) -> None:
        """GET-Requests mit Auto-ID."""
        id_list: Final = [1, 20, 30, 40, 50, 60, 70, 80, 90]
        for auto_id in id_list:
            self.client.get(f"/rest/{auto_id}")

    # -------------------------------------------------------------
    # GET /rest?modell=<teilstring>
    # -------------------------------------------------------------
    @task(200)
    def get_modell(self) -> None:
        """GET-Requests mit Query-Parameter: Teilstring vom Modell."""
        modell_list = ["a", "o", "e"]  # kommt in AUDI / BMW / MERCEDES / PORSCHE vor
        for teil in modell_list:
            self.client.get("/rest", params={"modell": teil})

    # -------------------------------------------------------------
    # GET /rest?fgnr=<value>
    # -------------------------------------------------------------
    @task(150)
    def get_fgnr(self) -> None:
        """GET Auto anhand FGNR."""
        fgnr_list: Final = [
            "1-0001-6",
            "1-0020-6",
            "1-0030-6",
            "1-0040-6",
            "1-0050-6",
            "1-0060-6",
            "1-0070-6",
            "1-0080-6",
            "1-0090-6",
        ]
        for fgnr in fgnr_list:
            self.client.get("/rest", params={"fgnr": fgnr})

    # -------------------------------------------------------------
    # GET /rest?<schlagwort>=true
    # -------------------------------------------------------------
    @task(150)
    def get_schlagwort(self) -> None:
        """GET Autos anhand Schlagwort."""
        schlagworte = ["sport", "komfort"]
        for wort in schlagworte:
            self.client.get("/rest", params={wort: "true"})
