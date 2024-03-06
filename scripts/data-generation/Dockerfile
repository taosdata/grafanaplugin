FROM tdengine/tdengine:3.2.3.0

RUN apt update && apt install -y python3 python3-pip
RUN pip3 install taopy

COPY main.py /main.py
COPY metrics.py /metrics.py

CMD ["python3", "/main.py"]
